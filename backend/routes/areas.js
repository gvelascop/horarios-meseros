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

// Consultar todas las áreas
router.get('/', async (req, res) => {
    try {
        const [areas] = await db.query(
            'SELECT * FROM areas WHERE estado = 1'
        );
        res.json(areas);
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

// Registrar un área
router.post('/', async (req, res) => {
    try {
        const { nombre } = req.body;

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({
                mensaje: 'El nombre del área es obligatorio'
            });
        }

        const [resultado] = await db.query(
            'INSERT INTO areas (nombre) VALUES (?)',
            [nombre.trim()]
        );

        res.status(201).json({
            mensaje: 'Área registrada correctamente',
            id: resultado.insertId
        });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

// Modificar un área
router.put('/:id', async (req, res) => {
    try {
        const { nombre } = req.body;

        if (!nombre || !nombre.trim()) {
            return res.status(400).json({
                mensaje: 'El nombre del área es obligatorio'
            });
        }

        const [resultado] = await db.query(
            'UPDATE areas SET nombre = ? WHERE id = ?',
            [nombre.trim(), req.params.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: 'Área no encontrada'
            });
        }

        res.json({ mensaje: 'Área actualizada correctamente' });
    } catch (error) {
        res.status(500).json({ mensaje: error.message });
    }
});

// Eliminar un área
router.delete('/:id', async (req, res) => {
    try {
        const [resultado] = await db.query(
            'UPDATE areas SET estado = 0 WHERE id = ?',
            [req.params.id]
        );

        if (resultado.affectedRows === 0) {
            return res.status(404).json({
                mensaje: 'Área no encontrada'
            });
        }

        res.json({
            mensaje: 'Área desactivada correctamente'
        });

    } catch (error) {
        res.status(500).json({
            mensaje: 'No se pudo desactivar el área.'
        });
    }
});

module.exports = router;