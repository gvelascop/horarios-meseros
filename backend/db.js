const mysql = require('mysql2/promise');
const { opcionesBaseDatos } = require('./config-db');
module.exports = mysql.createPool(opcionesBaseDatos());
