const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const express = require('express');
const mysql = require('mysql2/promise');
const { crearAutenticacion } = require('../seguridad/auth');
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });

test('acceso, CSRF, usuarios, sesiones persistentes y revocacion', async t => {
    const prefix = `prueba_auth_${randomBytes(6).toString('hex')}_`;
    const db = mysql.createPool({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, port: process.env.DB_PORT });
    const secret = randomBytes(48).toString('hex');
    const codigo = randomBytes(24).toString('hex');
    let auth;
    let server;
    try {
        auth = await crearAutenticacion({ db, prefix, secret, setupToken: codigo, rateMax: 6 });
        const app = express();
        app.use(express.json());
        app.use(auth.middlewareSesion, auth.cargarUsuario, auth.verificarCsrf);
        app.use('/api/auth', auth.router);
        app.use('/api', auth.requiereUsuario);
        app.get('/api/privado', (req, res) => res.json({ acceso: true }));
        app.use((error, req, res, next) => { res.status(500).json({ mensaje: error.message }); });
        server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
        const base = `http://127.0.0.1:${server.address().port}`;
        function cliente() {
            return { cookie: '', csrf: '', async pedir(ruta, method = 'GET', body, opciones = {}) {
                const headers = { ...(this.cookie ? { Cookie: this.cookie } : {}), ...opciones.headers };
                if (method !== 'GET' && opciones.csrf !== false) headers['X-CSRF-Token'] = this.csrf;
                if (body) headers['Content-Type'] = 'application/json';
                const r = await fetch(base + ruta, { method, headers, body: body ? JSON.stringify(body) : undefined });
                const cookies = r.headers.getSetCookie();
                if (cookies.length) this.cookie = cookies.at(-1).split(';')[0];
                const data = await r.json();
                if (data.csrf) this.csrf = data.csrf;
                return { status: r.status, data, cookies };
            } };
        }
        const admin = cliente();
        const anonimo = cliente();
        let userId;
        await t.test('la API deniega acceso sin sesion y rechaza login sin CSRF', async () => {
            assert.equal((await anonimo.pedir('/api/privado')).status, 401);
            assert.equal((await anonimo.pedir('/api/auth/login', 'POST', { usuario: 'admin', clave: 'x' }, { csrf: false })).status, 403);
            const estado = await admin.pedir('/api/auth/sesion');
            assert.equal(estado.data.configurado, false);
            assert.match(estado.cookies[0], /HttpOnly/i);
            assert.match(estado.cookies[0], /SameSite=Strict/i);
        });
        await t.test('configuracion inicial con codigo, clave fuerte y sesion rotada', async () => {
            const antes = admin.cookie;
            assert.equal((await admin.pedir('/api/auth/configurar', 'POST', { usuario: 'admin', nombre: 'Prueba', clave: 'Clave inicial segura 2026', codigo: 'mal' })).status, 403);
            const r = await admin.pedir('/api/auth/configurar', 'POST', { usuario: 'admin', nombre: 'Prueba', clave: 'Clave inicial segura 2026', codigo });
            assert.equal(r.status, 201);
            assert.equal(r.data.usuario.rol, 'admin');
            assert.notEqual(admin.cookie, antes);
            assert.equal((await admin.pedir('/api/privado')).status, 200);
            assert.equal((await admin.pedir('/api/auth/configurar', 'POST', { usuario: 'otro', nombre: 'Otro', clave: 'Otra clave segura 2026', codigo })).status, 409);
        });
        await t.test('solicitudes de otro origen bloqueadas y claves fuera de respuestas', async () => {
            const r = await admin.pedir('/api/auth/usuarios', 'POST', { usuario: 'editor', nombre: 'Editor', clave: 'Clave editor segura 2026' }, { headers: { Origin: 'https://otro-sitio.example' } });
            assert.equal(r.status, 403);
            assert.equal((await admin.pedir('/api/auth/usuarios', 'POST', { usuario: 'editor', nombre: 'Editor', clave: 'Clave editor segura 2026' })).status, 201);
            const lista = (await admin.pedir('/api/auth/usuarios')).data;
            userId = lista.find(u => u.usuario === 'editor').id;
            assert.ok(lista.every(u => !('clave_hash' in u)));
        });
        const editor = cliente();
        await t.test('login y separacion de permisos', async () => {
            await editor.pedir('/api/auth/sesion');
            assert.equal((await editor.pedir('/api/auth/login', 'POST', { usuario: 'editor', clave: 'incorrecta' })).status, 401);
            assert.equal((await editor.pedir('/api/auth/login', 'POST', { usuario: 'editor', clave: 'Clave editor segura 2026' })).status, 200);
            assert.equal((await editor.pedir('/api/privado')).status, 200);
            assert.equal((await editor.pedir('/api/auth/usuarios')).status, 403);
        });
        await t.test('las sesiones se guardan en MySQL y se pueden revocar', async () => {
            const [[r]] = await db.query(`SELECT COUNT(*) cantidad FROM ${prefix}sesiones`);
            assert.ok(r.cantidad >= 2);
            assert.equal((await admin.pedir(`/api/auth/usuarios/${userId}/estado`, 'PUT', { activo: false })).status, 200);
            assert.equal((await editor.pedir('/api/privado')).status, 401);
        });
        await t.test('cambiar clave invalida la sesion anterior y logout revoca la nueva', async () => {
            const vieja = cliente(); vieja.cookie = admin.cookie;
            const r = await admin.pedir('/api/auth/clave', 'POST', { actual: 'Clave inicial segura 2026', nueva: 'Una nueva clave segura 2026' });
            assert.equal(r.status, 200);
            assert.equal((await vieja.pedir('/api/privado')).status, 401);
            assert.equal((await admin.pedir('/api/privado')).status, 200);
            const copia = cliente(); copia.cookie = admin.cookie;
            assert.equal((await admin.pedir('/api/auth/logout', 'POST')).status, 200);
            assert.equal((await copia.pedir('/api/privado')).status, 401);
        });
        await t.test('se limita la fuerza bruta', async () => {
            const atacante = cliente(); await atacante.pedir('/api/auth/sesion');
            let r;
            for (let i = 0; i < 9; i++) r = await atacante.pedir('/api/auth/login', 'POST', { usuario: 'nadie', clave: 'incorrecta' });
            assert.equal(r.status, 429);
        });
    } finally {
        if (server) await new Promise(resolve => server.close(resolve));
        if (auth) await auth.store.close();
        for (const nombre of ['sesiones', 'usuarios', 'config']) await db.query(`DROP TABLE IF EXISTS ${prefix}${nombre}`);
        await db.end();
    }
});
