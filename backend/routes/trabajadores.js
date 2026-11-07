
const express = require('express');
const router = express.Router();
const mysql = require('mysql2/promise');

const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

// CONSULTAR TODOS LOS TRABAJADORES ACTIVOS
router.get('/', async (req, res) => {
    try {
        const [trabajadores] = await db.query(`
            SELECT
                trabajadores.*,
                areas.nombre AS area_nombre
            FROM trabajadores
            INNER JOIN areas
                ON trabajadores.area_id = areas.id
            WHERE trabajadores.estado = 1
              AND areas.estado = 1
            ORDER BY trabajadores.id ASC
        `);

        res.json(trabajadores);

    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: error.message
        });
    }
});

// REGISTRAR UN TRABAJADOR
router.post('/', async (req, res) => {
    try {
        const { nombre, area_id, cargo } = req.body;

        if (
            typeof nombre !== 'string' ||
            !nombre.trim() ||
            !Number.isInteger(Number(area_id)) ||
            Number(area_id) <= 0
        ) {
            return res.status(400).json({
                mensaje: 'El nombre y el área son obligatorios'
            });
        }

        const [areas] = await db.query(
            'SELECT id FROM areas WHERE id = ? AND estado = 1',
            [Number(area_id)]
        );

        if (areas.length === 0) {
            return res.status(400).json({
                mensaje: 'El área seleccionada no existe o está inactiva'
            });
        }

        const cargoFinal =
            typeof cargo === 'string' && cargo.trim()
                ? cargo.trim()
                : 'MESERO';

        const [resultado] = await db.query(
            `INSERT INTO trabajadores
             (nombre, area_id, cargo)
             VALUES (?, ?, ?)`,
            [
                nombre.trim(),
                area_id,
                cargoFinal
            ]
        );

        res.status(201).json({
            mensaje: 'Trabajador registrado correctamente',
            id: resultado.insertId
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: error.message
        });
    }
});

// Trasladar conserva la identidad y solo modifica la semana indicada.
router.put('/:id/area', async (req, res) => {
    const { area_id, semana_inicio } = req.body;
    const id = Number(req.params.id);
    const areaId = Number(area_id);
    const fecha = typeof semana_inicio === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(semana_inicio)
        ? new Date(semana_inicio + 'T00:00:00Z') : null;
    if (!Number.isSafeInteger(id) || id <= 0 || !Number.isSafeInteger(areaId) || areaId <= 0 ||
        !fecha || !Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== semana_inicio || fecha.getUTCDay() !== 1) {
        return res.status(400).json({ mensaje: 'Indica un trabajador, un area y una semana valida (lunes)' });
    }
    let conexion;
    try {
        conexion = await db.getConnection();
        await conexion.beginTransaction();
        const [trabajadores] = await conexion.query('SELECT id FROM trabajadores WHERE id = ? AND estado = 1 FOR UPDATE', [id]);
        const [areas] = await conexion.query('SELECT id FROM areas WHERE id = ? AND estado = 1', [areaId]);
        if (!trabajadores.length || !areas.length) {
            await conexion.rollback();
            return res.status(404).json({ mensaje: 'El trabajador o el area no estan activos' });
        }
        await conexion.query('UPDATE trabajadores SET area_id = ? WHERE id = ?', [areaId, id]);
        await conexion.query('UPDATE horarios SET area_id = ? WHERE trabajador_id = ? AND semana_inicio = ?', [areaId, id, semana_inicio]);
        // Una semana sin turnos tambien debe recordar el traslado.
        await conexion.query(
            "INSERT INTO horarios (trabajador_id, area_id, semana_inicio, dia_semana, horario) VALUES (?, ?, ?, 'Domingo', 'LIBRE') ON DUPLICATE KEY UPDATE id = id",
            [id, areaId, semana_inicio]
        );
        await conexion.commit();
        res.json({ mensaje: 'Mesero trasladado sin cambiar las semanas anteriores', trabajador_id: id, area_id: areaId, semana_inicio });
    } catch (error) {
        if (conexion) await conexion.rollback();
        console.error('Error al trasladar trabajador:', error);
        res.status(500).json({ mensaje: 'No se pudo trasladar al trabajador' });
    } finally {
        if (conexion) conexion.release();
    }
});

// ACTUALIZAR NOMBRE, ÁREA Y CARGO
router.put('/:id', async (req, res) => {
    try {
        const { nombre, area_id, cargo } = req.body;
        const { id } = req.params;

        if (
            typeof nombre !== 'string' ||
            !nombre.trim() ||
            !Number.isInteger(Number(area_id)) ||
            Number(area_id) <= 0
        ) {
            return res.status(400).json({
                mensaje: 'El nombre y el área son obligatorios'
            });
        }

        const [areas] = await db.query(
            'SELECT id FROM areas WHERE id = ? AND estado = 1',
            [Number(area_id)]
        );

        if (areas.length === 0) {
            return res.status(400).json({
                mensaje: 'El área seleccionada no existe o está inactiva'
            });
        }

        // Si el frontend anterior no envía cargo,
        // se conserva el que ya tiene el trabajador.
        const [existentes] = await db.query(
            `SELECT cargo
             FROM trabajadores
             WHERE id = ? AND estado = 1`,
            [id]
        );

        if (existentes.length === 0) {
            return res.status(404).json({
                mensaje: 'Trabajador no encontrado'
            });
        }

        const cargoFinal =
            typeof cargo === 'string' && cargo.trim()
                ? cargo.trim()
                : existentes[0].cargo;

        await db.query(
            `UPDATE trabajadores
             SET nombre = ?,
                 area_id = ?,
                 cargo = ?
             WHERE id = ? AND estado = 1`,
            [
                nombre.trim(),
                area_id,
                cargoFinal,
                id
            ]
        );

        res.json({
            mensaje: 'Trabajador actualizado correctamente'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: error.message
        });
    }
});

// DESACTIVAR UN TRABAJADOR
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const [resultado] = await db.query(
            `UPDATE trabajadores
             SET estado = 0
             WHERE id = ? AND estado = 1`,
            [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: 'Trabajador no encontrado'
            });
        }

        res.json({
            mensaje: 'Trabajador desactivado correctamente'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: 'Error al desactivar el trabajador'
        });
    }
});

// REACTIVAR UN TRABAJADOR DESACTIVADO
router.post('/:id/reactivar', async (req, res) => {
    try {
        const { id } = req.params;

        const [resultado] = await db.query(
            `UPDATE trabajadores t
             INNER JOIN areas a
                 ON a.id = t.area_id AND a.estado = 1
             SET t.estado = 1
             WHERE t.id = ? AND t.estado = 0`,
            [id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: 'Trabajador no encontrado o su área está inactiva'
            });
        }

        res.json({
            mensaje: 'Trabajador reactivado correctamente'
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: 'Error al reactivar el trabajador'
        });
    }
});

module.exports = router;
