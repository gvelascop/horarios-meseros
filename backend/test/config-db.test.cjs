const { test } = require('node:test');
const assert = require('node:assert/strict');
const { opcionesBaseDatos } = require('../config-db');
const base = { DB_HOST: 'db.ejemplo.com', DB_USER: 'usuario', DB_NAME: 'horarios', DB_PASSWORD: 'clave' };
test('base local funciona sin TLS y todas las rutas comparten configuracion', () => {
    const config = opcionesBaseDatos(base);
    assert.equal(config.port, 3306);
    assert.equal(config.connectionLimit, 5);
    assert.equal(config.ssl, undefined);
});
test('TiDB usa TLS y verifica el certificado del servidor', () => {
    const config = opcionesBaseDatos({ ...base, NODE_ENV: 'production', DB_PORT: '4000', DB_SSL: 'true' });
    assert.equal(config.port, 4000);
    assert.equal(config.ssl.rejectUnauthorized, true);
    assert.equal(config.ssl.minVersion, 'TLSv1.2');
});
test('produccion rechaza conexiones sin cifrar y configuraciones incompletas', () => {
    assert.throws(() => opcionesBaseDatos({ ...base, NODE_ENV: 'production' }), /DB_SSL/);
    assert.throws(() => opcionesBaseDatos({ ...base, DB_PORT: 'incorrecto' }), /DB_PORT/);
    assert.throws(() => opcionesBaseDatos({ ...base, DB_SSL: 'otro' }), /DB_SSL/);
    assert.throws(() => opcionesBaseDatos({ DB_HOST: 'localhost' }), /DB_USER/);
});
