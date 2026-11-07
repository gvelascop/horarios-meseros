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

router.get('/meseros-por-area', async (req, res) => {
    try {
        const [estadisticas] = await db.query(`
            SELECT
                a.id AS area_id,
                a.nombre AS area,
                t.id AS trabajador_id,
                t.nombre AS trabajador,
                COUNT(
                    CASE
                        WHEN UPPER(TRIM(COALESCE(h.horario, ''))) NOT IN (
                            '',
                            'LIBRE',
                            'DESCANSO',
                            'COMPENSATORIO',
                            'INCAPACIDAD',
                            'LICENCIA'
                        )
                        THEN h.id
                    END
                ) AS dias_trabajados
            FROM areas a
            CROSS JOIN trabajadores t
            LEFT JOIN horarios h
                ON h.trabajador_id = t.id
               AND h.area_id = a.id
            WHERE t.estado = 1
              AND a.estado = 1
            GROUP BY
                a.id,
                a.nombre,
                t.id,
                t.nombre
            ORDER BY
                a.nombre,
                dias_trabajados DESC,
                t.nombre
        `);

        res.json(estadisticas);
    } catch (error) {
        console.error('Error al consultar estadísticas por área:', error);
        res.status(500).json({
            mensaje: 'Error al consultar las estadísticas por área'
        });
    }
});

module.exports = router;