const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env'), quiet: true });
const mysql = require('mysql2/promise');
const planilla = require('./horarios-2026-11-01.json');

async function main() {
  const db = await mysql.createConnection({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, port: process.env.DB_PORT, connectTimeout: 10000 });
  try {
    await db.beginTransaction();
    const ids = planilla.trabajadores.map(t => t.id);
    if (new Set(ids).size !== ids.length || planilla.trabajadores.some(t => t.horarios.length !== 7)) throw new Error('Planilla incompleta o duplicada');
    const [trabajadores] = await db.query('SELECT * FROM trabajadores WHERE id IN (?) FOR UPDATE', [ids]);
    if (trabajadores.length !== ids.length) throw new Error('Faltan trabajadores esperados');
    const [horarios] = await db.query('SELECT * FROM horarios WHERE trabajador_id IN (?) AND semana_inicio = ? FOR UPDATE', [ids, planilla.semana_inicio]);
    const resumen = { meseros: ids.length, turnos: ids.length * 7, turnosExistentes: horarios.length, personasPorActualizar: planilla.trabajadores.filter(t => { const actual = trabajadores.find(a => a.id === t.id); return actual.nombre !== t.nombre || actual.area_id !== t.area_id || actual.estado !== 1; }).map(t => ({ id: t.id, nombre: t.nombre })) };
    if (!process.argv.includes('--aplicar')) { console.log(JSON.stringify(resumen)); await db.rollback(); return; }
    const carpeta = path.join(__dirname, 'respaldos');
    fs.mkdirSync(carpeta, { recursive: true });
    const respaldo = path.join(carpeta, 'antes-importacion-' + Date.now() + '.json');
    fs.writeFileSync(respaldo, JSON.stringify({ semana_inicio: planilla.semana_inicio, trabajadores, horarios }, null, 2));
    for (const t of planilla.trabajadores) {
      await db.query('UPDATE trabajadores SET nombre = ?, area_id = ?, estado = 1 WHERE id = ?', [t.nombre, t.area_id, t.id]);
      for (let i = 0; i < 7; i++) {
        await db.query('INSERT INTO horarios (trabajador_id, area_id, semana_inicio, dia_semana, horario) VALUES (?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE area_id = VALUES(area_id), horario = VALUES(horario)', [t.id, t.area_id, planilla.semana_inicio, planilla.dias[i], t.horarios[i]]);
      }
    }
    const [verificacion] = await db.query('SELECT trabajador_id, area_id, dia_semana, horario FROM horarios WHERE trabajador_id IN (?) AND semana_inicio = ?', [ids, planilla.semana_inicio]);
    if (verificacion.length !== ids.length * 7) throw new Error('Cantidad de turnos incorrecta');
    for (const t of planilla.trabajadores) for (let i = 0; i < 7; i++) {
      const fila = verificacion.find(h => h.trabajador_id === t.id && h.dia_semana === planilla.dias[i]);
      if (!fila || fila.horario !== t.horarios[i] || fila.area_id !== t.area_id) throw new Error('La verificacion no coincide');
    }
    await db.commit();
    console.log(JSON.stringify({ ...resumen, guardado: true, turnosVerificados: verificacion.length, respaldo }));
  } catch (error) { await db.rollback(); throw error; }
  finally { await db.end(); }
}
main().catch(error => { console.error(error.code || error.message); process.exitCode = 1; });
