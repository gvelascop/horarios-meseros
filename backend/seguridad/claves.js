const { randomBytes, scrypt, timingSafeEqual } = require('node:crypto');
const { promisify } = require('node:util');
const derivar = promisify(scrypt);
const opciones = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

function validarClave(clave) {
    return typeof clave === 'string' && clave.length >= 12 && Buffer.byteLength(clave, 'utf8') <= 256;
}
async function crearHash(clave) {
    const sal = randomBytes(16).toString('hex');
    const hash = await derivar(clave, sal, 64, opciones);
    return `scrypt$${sal}$${hash.toString('hex')}`;
}
async function verificarClave(clave, guardado) {
    if (typeof clave !== 'string' || Buffer.byteLength(clave, 'utf8') > 256) return false;
    const [algoritmo, sal, texto] = String(guardado || '').split('$');
    if (algoritmo !== 'scrypt' || !/^[a-f0-9]{32}$/.test(sal) || !/^[a-f0-9]{128}$/.test(texto)) return false;
    const calculado = await derivar(clave, sal, 64, opciones);
    return timingSafeEqual(calculado, Buffer.from(texto, 'hex'));
}
function iguales(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const primero = Buffer.from(a);
    const segundo = Buffer.from(b);
    return primero.length === segundo.length && timingSafeEqual(primero, segundo);
}
module.exports = { validarClave, crearHash, verificarClave, iguales };
