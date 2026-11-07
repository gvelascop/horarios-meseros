const express = require('express');
const session = require('express-session');
const MySQLStore = require('express-mysql-session')(session);
const { rateLimit } = require('express-rate-limit');
const { randomBytes } = require('node:crypto');
const { validarClave, crearHash, verificarClave, iguales } = require('./claves');

async function crearAutenticacion({ db, secret, setupToken, prefix = 'seguridad_', production = false, appOrigin = '', rateMax = 10 }) {
    if (!/^[a-z_0-9]+$/.test(prefix)) throw new Error('Prefijo invalido');
    if (!secret || secret.length < 32) throw new Error('SESSION_SECRET debe tener al menos 32 caracteres');
    const usuarios = `${prefix}usuarios`;
    const config = `${prefix}config`;
    await db.query(`CREATE TABLE IF NOT EXISTS ${usuarios} (
        id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
        usuario VARCHAR(80) NOT NULL UNIQUE,
        nombre VARCHAR(100) NOT NULL,
        clave_hash VARCHAR(255) NOT NULL,
        rol VARCHAR(12) NOT NULL DEFAULT 'editor',
        activo TINYINT NOT NULL DEFAULT 1,
        version INT NOT NULL DEFAULT 1,
        creado TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await db.query(`CREATE TABLE IF NOT EXISTS ${config} (id INT NOT NULL PRIMARY KEY)`);
    await db.query(`INSERT IGNORE INTO ${config} (id) VALUES (1)`);
    const store = new MySQLStore({
        expiration: 8 * 60 * 60 * 1000,
        endConnectionOnClose: false,
        schema: { tableName: `${prefix}sesiones`, columnNames: { session_id: 'session_id', expires: 'expires', data: 'data' } }
    }, db);
    await store.onReady();
    const cookieName = production ? '__Host-horarios.sid' : 'horarios.sid';
    const cookie = { httpOnly: true, sameSite: 'strict', secure: production, path: '/', maxAge: 8 * 60 * 60 * 1000 };
    const middlewareSesion = session({
        name: cookieName, secret, store, resave: false, saveUninitialized: false,
        cookie, unset: 'destroy'
    });
    const router = express.Router();
    const falsoHash = await crearHash(randomBytes(24).toString('hex'));
    const publico = u => ({ id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol });
    const guardar = req => new Promise((resolve, reject) => req.session.save(error => error ? reject(error) : resolve()));
    const regenerar = req => new Promise((resolve, reject) => req.session.regenerate(error => error ? reject(error) : resolve()));
    const destruir = req => new Promise((resolve, reject) => req.session.destroy(error => error ? reject(error) : resolve()));
    async function iniciarSesion(req, usuario) {
        await regenerar(req);
        req.session.usuarioId = usuario.id;
        req.session.version = usuario.version;
        req.session.csrf = randomBytes(32).toString('hex');
        await guardar(req);
        return { usuario: publico(usuario), csrf: req.session.csrf, configurado: true };
    }
    async function cargarUsuario(req, res, next) {
        if (req.session?.usuarioId) {
            const [filas] = await db.query(`SELECT id, usuario, nombre, rol, activo, version FROM ${usuarios} WHERE id = ?`, [req.session.usuarioId]);
            const u = filas[0];
            if (u?.activo && u.version === req.session.version) req.usuario = u;
            else { await regenerar(req); }
        }
        next();
    }
    function requiereUsuario(req, res, next) {
        if (!req.usuario) return res.status(401).json({ mensaje: 'Inicia sesion para continuar' });
        next();
    }
    function requiereAdmin(req, res, next) {
        if (req.usuario.rol !== 'admin') return res.status(403).json({ mensaje: 'Solo el administrador puede realizar esta accion' });
        next();
    }
    function verificarCsrf(req, res, next) {
        if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
        const origin = req.get('origin');
        const esperado = appOrigin || `${req.protocol}://${req.get('host')}`;
        if (req.get('sec-fetch-site') === 'cross-site' || (origin && origin !== esperado) || !iguales(req.get('x-csrf-token'), req.session?.csrf)) {
            return res.status(403).json({ mensaje: 'La solicitud no es valida. Actualiza la pagina e intenta de nuevo.' });
        }
        next();
    }
    const limitarAcceso = rateLimit({ windowMs: 15 * 60 * 1000, limit: rateMax, standardHeaders: 'draft-8', legacyHeaders: false,
        skipSuccessfulRequests: true, message: { mensaje: 'Demasiados intentos. Espera 15 minutos antes de intentar de nuevo.' } });
    router.get('/sesion', async (req, res) => {
        const [[estado]] = await db.query(`SELECT COUNT(*) AS cantidad FROM ${usuarios}`);
        if (!req.session) return res.status(401).json({ mensaje: 'La sesion expiro. Actualiza la pagina.' });
        if (!req.session.csrf) req.session.csrf = randomBytes(32).toString('hex');
        await guardar(req);
        res.json({ configurado: Number(estado.cantidad) > 0, usuario: req.usuario ? publico(req.usuario) : null, csrf: req.session.csrf });
    });
    router.post('/configurar', limitarAcceso, async (req, res) => {
        if (!iguales(req.body.codigo, setupToken)) return res.status(403).json({ mensaje: 'Codigo de configuracion incorrecto' });
        const { usuario, nombre, clave } = req.body;
        if (!datosValidos(usuario, nombre, clave)) return res.status(400).json({ mensaje: 'Usa un usuario de 3 a 80 caracteres y una clave de al menos 12 caracteres (maximo 256 bytes).' });
        const hash = await crearHash(clave);
        const conexion = await db.getConnection();
        let nuevo;
        try {
            await conexion.beginTransaction();
            await conexion.query(`SELECT id FROM ${config} WHERE id = 1 FOR UPDATE`);
            const [[estado]] = await conexion.query(`SELECT COUNT(*) AS cantidad FROM ${usuarios}`);
            if (Number(estado.cantidad)) { await conexion.rollback(); return res.status(409).json({ mensaje: 'La cuenta inicial ya fue creada' }); }
            const [resultado] = await conexion.query(`INSERT INTO ${usuarios} (usuario, nombre, clave_hash, rol) VALUES (?, ?, ?, 'admin')`, [usuario.trim().toLowerCase(), nombre.trim(), hash]);
            nuevo = { id: resultado.insertId, usuario: usuario.trim().toLowerCase(), nombre: nombre.trim(), rol: 'admin', version: 1 };
            await conexion.commit();
        } catch (error) { await conexion.rollback(); throw error; }
        finally { conexion.release(); }
        res.status(201).json(await iniciarSesion(req, nuevo));
    });
    router.post('/login', limitarAcceso, async (req, res) => {
        const { usuario, clave } = req.body;
        if (typeof usuario !== 'string' || usuario.length > 80 || typeof clave !== 'string' || Buffer.byteLength(clave) > 256) return res.status(401).json({ mensaje: 'Usuario o clave incorrectos' });
        const [filas] = await db.query(`SELECT * FROM ${usuarios} WHERE usuario = ? LIMIT 1`, [usuario.trim().toLowerCase()]);
        const u = filas[0];
        const valido = await verificarClave(clave, u?.clave_hash || falsoHash);
        if (!u?.activo || !valido) return res.status(401).json({ mensaje: 'Usuario o clave incorrectos' });
        res.json(await iniciarSesion(req, u));
    });
    router.post('/logout', async (req, res) => {
        await destruir(req);
        res.clearCookie(cookieName, { path: '/', secure: production, sameSite: 'strict', httpOnly: true });
        res.json({ mensaje: 'Sesion cerrada' });
    });
    router.post('/clave', requiereUsuario, limitarAcceso, async (req, res) => {
        const { actual, nueva } = req.body;
        if (!validarClave(nueva)) return res.status(400).json({ mensaje: 'La nueva clave debe tener al menos 12 caracteres (maximo 256 bytes)' });
        const [[u]] = await db.query(`SELECT * FROM ${usuarios} WHERE id = ?`, [req.usuario.id]);
        if (!await verificarClave(actual, u.clave_hash)) return res.status(400).json({ mensaje: 'La clave actual no es correcta' });
        const hash = await crearHash(nueva);
        await db.query(`UPDATE ${usuarios} SET clave_hash = ?, version = version + 1 WHERE id = ?`, [hash, u.id]);
        u.version += 1;
        res.json(await iniciarSesion(req, u));
    });
    router.get('/usuarios', requiereUsuario, requiereAdmin, async (req, res) => {
        const [filas] = await db.query(`SELECT id, usuario, nombre, rol, activo FROM ${usuarios} ORDER BY id`);
        res.json(filas);
    });
    router.post('/usuarios', requiereUsuario, requiereAdmin, async (req, res) => {
        const { usuario, nombre, clave, rol = 'editor' } = req.body;
        if (!datosValidos(usuario, nombre, clave) || !['admin', 'editor'].includes(rol)) return res.status(400).json({ mensaje: 'Revisa el nombre, usuario, rol y clave (minimo 12 caracteres)' });
        const hash = await crearHash(clave);
        try {
            await db.query(`INSERT INTO ${usuarios} (usuario, nombre, clave_hash, rol) VALUES (?, ?, ?, ?)`, [usuario.trim().toLowerCase(), nombre.trim(), hash, rol]);
        } catch (error) { if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ mensaje: 'Ese usuario ya existe' }); throw error; }
        res.status(201).json({ mensaje: 'Usuario creado correctamente' });
    });
    router.put('/usuarios/:id/estado', requiereUsuario, requiereAdmin, async (req, res) => {
        const id = Number(req.params.id);
        if (!Number.isSafeInteger(id) || id <= 0 || typeof req.body.activo !== 'boolean') return res.status(400).json({ mensaje: 'Datos invalidos' });
        if (id === req.usuario.id) return res.status(400).json({ mensaje: 'No puedes desactivar tu propia cuenta' });
        const [resultado] = await db.query(`UPDATE ${usuarios} SET activo = ?, version = version + 1 WHERE id = ?`, [req.body.activo ? 1 : 0, id]);
        if (!resultado.affectedRows) return res.status(404).json({ mensaje: 'Usuario no encontrado' });
        res.json({ mensaje: 'Estado actualizado' });
    });
    function datosValidos(usuario, nombre, clave) {
        return typeof usuario === 'string' && /^[a-zA-Z0-9._@-]{3,80}$/.test(usuario.trim()) &&
            typeof nombre === 'string' && nombre.trim().length > 0 && nombre.trim().length <= 100 && validarClave(clave);
    }
    return { router, middlewareSesion, cargarUsuario, verificarCsrf, requiereUsuario, store };
}
module.exports = { crearAutenticacion };
