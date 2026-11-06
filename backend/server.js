const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
require('dotenv').config();
const areasRoutes = require('./routes/areas');
const trabajadoresRoutes = require('./routes/trabajadores');
const horariosRoutes = require('./routes/horarios');
const estadisticasRoutes = require('./routes/estadisticas');

const app = express();

app.use(cors());
app.use(express.json());
app.use('/api/areas', areasRoutes);
app.use('/api/trabajadores', trabajadoresRoutes);
app.use('/api/horarios', horariosRoutes);
app.use('/api/estadisticas', estadisticasRoutes);

// Conexión con MySQL
const db = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: process.env.DB_PORT
});

// Ruta para comprobar la conexión
app.get('/api/test-db', async (req, res) => {
    try {
        const [resultado] = await db.query('SELECT DATABASE() AS base_datos');

        res.json({
            mensaje: 'Conexión con MySQL exitosa',
            base_datos: resultado[0].base_datos
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({
            mensaje: 'Error al conectar con MySQL'
        });
    }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor funcionando en http://localhost:${PORT}`);
});