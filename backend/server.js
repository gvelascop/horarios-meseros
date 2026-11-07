const path = require('node:path');
const fs = require('node:fs');
const { randomBytes } = require('node:crypto');
const express = require('express');
const helmet = require('helmet');
require('dotenv').config({ path: path.join(__dirname, '.env'), quiet: true });
const { crearAutenticacion } = require('./seguridad/auth');

async function iniciar() {
    const production = process.env.NODE_ENV === 'production';
    if (production && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) {
        throw new Error('Configura SESSION_SECRET (minimo 32 caracteres) antes de publicar');
    }
    if (production && (!process.env.SETUP_TOKEN || process.env.SETUP_TOKEN.length < 32)) {
        throw new Error('Configura SETUP_TOKEN (minimo 32 caracteres) en el alojamiento');
    }
    const archivoLocal = path.join(__dirname, '.auth-local.json');
    let local = {};
    if (!process.env.SESSION_SECRET || !process.env.SETUP_TOKEN) {
        if (fs.existsSync(archivoLocal)) local = JSON.parse(fs.readFileSync(archivoLocal, 'utf8'));
        else {
            local = { SESSION_SECRET: randomBytes(48).toString('hex'), SETUP_TOKEN: randomBytes(24).toString('hex') };
            fs.writeFileSync(archivoLocal, JSON.stringify(local, null, 2), { flag: 'wx', mode: 0o600 });
        }
    }
    const db = require('./db');
    const auth = await crearAutenticacion({ db, secret: process.env.SESSION_SECRET || local.SESSION_SECRET,
        setupToken: process.env.SETUP_TOKEN || local.SETUP_TOKEN, production, appOrigin: process.env.APP_ORIGIN || process.env.RENDER_EXTERNAL_URL || '' });
    const app = express();
    app.disable('x-powered-by');
    if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
    app.use(helmet({ contentSecurityPolicy: { directives: { upgradeInsecureRequests: production ? [] : null } } }));
    app.get('/healthz', async (req, res) => {
        res.set('Cache-Control', 'no-store');
        try { await db.query('SELECT 1'); res.json({ estado: 'ok' }); }
        catch { res.status(503).json({ estado: 'no disponible' }); }
    });
    app.use(express.json({ limit: '32kb' }));
    app.use('/api', (req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
    app.use('/api', auth.middlewareSesion, auth.cargarUsuario, auth.verificarCsrf);
    app.use('/api/auth', auth.router);
    app.use('/api', auth.requiereUsuario);
    app.use('/api/areas', require('./routes/areas'));
    app.use('/api/trabajadores', require('./routes/trabajadores'));
    app.use('/api/horarios', require('./routes/horarios'));
    app.use('/api/estadisticas', require('./routes/estadisticas'));
    app.get('/api/test-db', async (req, res) => { await db.query('SELECT 1'); res.json({ mensaje: 'Servicio disponible' }); });
    app.use('/api', (req, res) => res.status(404).json({ mensaje: 'Ruta no encontrada' }));
    app.use(express.static(path.join(__dirname, '../frontend/dist')));
    app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => res.sendFile(path.join(__dirname, '../frontend/dist/index.html')));
    app.use((error, req, res, next) => {
        if (res.headersSent) return next(error);
        console.error('Error de solicitud:', error.code || error.name);
        const status = error.type === 'entity.parse.failed' ? 400 : error.type === 'entity.too.large' ? 413 : 500;
        res.status(status).json({ mensaje: status === 400 ? 'JSON invalido' : status === 413 ? 'Solicitud demasiado grande' : 'No se pudo completar la solicitud' });
    });
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, '0.0.0.0', () => {
        console.log(`Servidor funcionando en puerto ${PORT}. Acceso protegido.`);
        console.log('Primera cuenta: usa SETUP_TOKEN de tu entorno o del archivo local backend/.auth-local.json.');
    });
}
iniciar().catch(error => { console.error('No se pudo iniciar el servidor:', error.code || error.message); process.exitCode = 1; });
