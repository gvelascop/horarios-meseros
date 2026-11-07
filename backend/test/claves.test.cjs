const { test } = require('node:test');
const assert = require('node:assert/strict');
const { crearHash, verificarClave, validarClave } = require('../seguridad/claves');

test('hash con sal aleatoria, verificacion y limites de clave', async () => {
    const clave = 'Una frase de prueba 2026!';
    const a = await crearHash(clave);
    const b = await crearHash(clave);
    assert.notEqual(a, b);
    assert.ok(!a.includes(clave));
    assert.equal(await verificarClave(clave, a), true);
    assert.equal(await verificarClave('incorrecta', a), false);
    assert.equal(await verificarClave(clave, 'hash-invalido'), false);
    assert.equal(await verificarClave('x'.repeat(257), a), false);
    assert.equal(validarClave('corta'), false);
    assert.equal(validarClave(clave), true);
    assert.equal(validarClave('x'.repeat(257)), false);
});
