
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

const diasValidos = [
    'Lunes',
    'Martes',
    'Miercoles',
    'Jueves',
    'Viernes',
    'Sabado',
    'Domingo'
];

// VALIDAR FORMATO DE FECHA
function fechaValida(fecha) {
    if (
        typeof fecha !== 'string' ||
        !/^\d{4}-\d{2}-\d{2}$/.test(fecha)
    ) {
        return false;
    }

    const [anio, mes, dia] = fecha.split('-').map(Number);

    const comprobacion = new Date(
        Date.UTC(anio, mes - 1, dia)
    );

    return (
        comprobacion.getUTCFullYear() === anio &&
        comprobacion.getUTCMonth() === mes - 1 &&
        comprobacion.getUTCDate() === dia
    );
}

// CONSULTAR HORARIOS DE UNA SEMANA
router.get('/', async (req, res) => {
    try {
        const { semana_inicio } = req.query;

        if (!fechaValida(semana_inicio)) {
            return res.status(400).json({
                mensaje: 'Debes indicar una fecha válida (AAAA-MM-DD)'
            });
        }

        const [horarios] = await db.query(`
            SELECT
                h.id,
                h.trabajador_id,
                COALESCE(h.area_id, t.area_id) AS area_id,
                t.nombre AS trabajador,
                a.nombre AS area,
                DATE_FORMAT(
                    h.semana_inicio,
                    '%Y-%m-%d'
                ) AS semana_inicio,
                h.dia_semana,
                h.horario
            FROM horarios h
            INNER JOIN trabajadores t
                ON h.trabajador_id = t.id
            INNER JOIN areas a
                ON COALESCE(h.area_id, t.area_id) = a.id
            WHERE h.semana_inicio = ?
              AND t.estado = 1
              AND a.estado = 1
            ORDER BY
                a.nombre,
                t.nombre,
                FIELD(
                    h.dia_semana,
                    'Domingo',
                    'Lunes',
                    'Martes',
                    'Miercoles',
                    'Jueves',
                    'Viernes',
                    'Sabado'
                )
        `, [semana_inicio]);

        res.json(horarios);

    } catch (error) {
        console.error('Error al consultar horarios:', error);

        res.status(500).json({
            mensaje: 'Error al consultar los horarios'
        });
    }
});

// GUARDAR O ACTUALIZAR UN HORARIO
router.post('/', async (req, res) => {
    try {
        const {
            trabajador_id,
            semana_inicio,
            dia_semana,
            horario
        } = req.body;

        if (
            !Number.isInteger(Number(trabajador_id)) ||
            Number(trabajador_id) <= 0 ||
            !fechaValida(semana_inicio) ||
            !diasValidos.includes(dia_semana) ||
            typeof horario !== 'string'
        ) {
            return res.status(400).json({
                mensaje: 'Los datos del horario no son válidos'
            });
        }

        // Si la celda queda vacía, se guarda LIBRE.
        const horarioFinal = horario.trim() || 'LIBRE';

        if (horarioFinal.length > 100) {
            return res.status(400).json({
                mensaje: 'El horario no puede superar 100 caracteres'
            });
        }

        // Verificar que el trabajador esté activo.
        const [trabajadores] = await db.query(`
            SELECT t.id, t.area_id
            FROM trabajadores t
            INNER JOIN areas a ON t.area_id = a.id
            WHERE t.id = ?
              AND t.estado = 1
              AND a.estado = 1
        `, [trabajador_id]);

        if (trabajadores.length === 0) {
            return res.status(404).json({
                mensaje: 'El trabajador no existe o está inactivo'
            });
        }

        // Usar el area original al completar una semana ya registrada.
        const [registrosSemana] = await db.query(
            'SELECT area_id FROM horarios WHERE trabajador_id = ? AND semana_inicio = ? AND area_id IS NOT NULL ORDER BY id ASC LIMIT 1',
            [trabajador_id, semana_inicio]
        );
        const areaSemana = registrosSemana[0]?.area_id ?? trabajadores[0].area_id;

        // Guardar o actualizar sin crear duplicados.
        await db.query(`
            INSERT INTO horarios (
                trabajador_id,
                area_id,
                semana_inicio,
                dia_semana,
                horario
            )
            VALUES (?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                area_id = COALESCE(area_id, VALUES(area_id)),
                horario = VALUES(horario)
        `, [
            trabajador_id,
            areaSemana,
            semana_inicio,
            dia_semana,
            horarioFinal
        ]);

        const [guardados] = await db.query(
            'SELECT id, area_id FROM horarios WHERE trabajador_id = ? AND semana_inicio = ? AND dia_semana = ?',
            [trabajador_id, semana_inicio, dia_semana]
        );
        res.json({
            id: guardados[0].id,
            area_id: guardados[0].area_id,
            mensaje: 'Horario guardado correctamente',
            trabajador_id: Number(trabajador_id),
            semana_inicio,
            dia_semana,
            horario: horarioFinal
        });

    } catch (error) {
        console.error('Error al guardar horario:', error);

        res.status(500).json({
            mensaje: 'Error al guardar el horario'
        });
    }
});

module.exports = router;
