const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const { opcionesBaseDatos } = require('../config-db');
async function exportar() {
    const db = await mysql.createConnection({ ...opcionesBaseDatos(), dateStrings: true });
    try {
        await db.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
        const estructura = fs.readFileSync(path.join(__dirname, '../../database/000_esquema_inicial.sql'), 'utf8');
        const tablas = ['areas', 'trabajadores', 'horarios'];
        const partes = ['-- Datos laborales privados: no subir a GitHub ni compartir publicamente.', 'SET NAMES utf8mb4;', estructura, 'START TRANSACTION;'];
        const cantidades = {};
        for (const tabla of tablas) {
            const [filas, campos] = await db.query(`SELECT * FROM ${tabla} ORDER BY id`);
            cantidades[tabla] = filas.length;
            const columnas = campos.map(c => mysql.escapeId(c.name)).join(', ');
            for (let i = 0; i < filas.length; i += 100) {
                const valores = filas.slice(i, i + 100).map(fila => '(' + campos.map(c => mysql.escape(fila[c.name])).join(', ') + ')');
                partes.push(`INSERT INTO ${tabla} (${columnas}) VALUES\n${valores.join(',\n')};`);
            }
        }
        partes.push('COMMIT;');
        await db.rollback(); // Solo se leyo la base de origen.
        const carpeta = path.join(__dirname, '../../database/exportaciones');
        fs.mkdirSync(carpeta, { recursive: true });
        const archivo = path.join(carpeta, 'horarios-' + Date.now() + '.sql');
        fs.writeFileSync(archivo, partes.join('\n\n'), { flag: 'wx', mode: 0o600 });
        console.log(JSON.stringify({ archivo, cantidades, incluyeUsuariosDeAcceso: false, incluyeSesiones: false }));
    } finally { await db.end(); }
}
exportar().catch(error => { console.error('No se pudo exportar:', error.code || error.message); process.exitCode = 1; });
