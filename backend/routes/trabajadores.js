
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
            !area_id
        ) {
            return res.status(400).json({
                mensaje: 'El nombre y el área son obligatorios'
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

// ACTUALIZAR NOMBRE, ÁREA Y CARGO
router.put('/:id', async (req, res) => {
    try {
        const { nombre, area_id, cargo } = req.body;
        const { id } = req.params;

        if (
            typeof nombre !== 'string' ||
            !nombre.trim() ||
            !area_id
        ) {
            return res.status(400).json({
                mensaje: 'El nombre y el área son obligatorios'
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

module.exports = router;
