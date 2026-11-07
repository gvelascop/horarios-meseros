const fs = require('node:fs');
function opcionesBaseDatos(env = process.env) {
    for (const campo of ['DB_HOST', 'DB_USER', 'DB_NAME']) {
        if (!env[campo]) throw new Error(`Falta configurar ${campo}`);
    }
    const port = Number(env.DB_PORT || 3306);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('DB_PORT invalido');
    if (env.DB_SSL && !['true', 'false'].includes(env.DB_SSL)) throw new Error('DB_SSL debe ser true o false');
    if (env.NODE_ENV === 'production' && env.DB_SSL !== 'true') throw new Error('La base de datos de produccion requiere DB_SSL=true');
    const opciones = {
        host: env.DB_HOST, port, user: env.DB_USER, password: env.DB_PASSWORD,
        database: env.DB_NAME, waitForConnections: true, connectionLimit: 5,
        queueLimit: 100, connectTimeout: 15000, enableKeepAlive: true
    };
    if (env.DB_SSL === 'true') {
        opciones.ssl = { rejectUnauthorized: true, minVersion: 'TLSv1.2' };
        if (env.DB_SSL_CA_FILE) opciones.ssl.ca = fs.readFileSync(env.DB_SSL_CA_FILE, 'utf8');
    }
    return opciones;
}
module.exports = { opcionesBaseDatos };
