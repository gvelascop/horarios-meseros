const express = require('express');
const router = express.Router();
const db = require('../db');

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
const normalizar = valor => String(valor || '').trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').toUpperCase();

router.post('/', async (req, res) => {
  const { semana_inicio, filas } = req.body || {};
  const fecha = typeof semana_inicio === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(semana_inicio)
    ? new Date(semana_inicio + 'T00:00:00Z') : null;
  if (!fecha || !Number.isFinite(fecha.getTime()) || fecha.toISOString().slice(0, 10) !== semana_inicio || fecha.getUTCDay() !== 1 ||
      !Array.isArray(filas) || !filas.length || filas.length > 300) {
    return res.status(400).json({ mensaje: 'Selecciona una semana válida y entre 1 y 300 trabajadores.' });
  }
  const claves = new Set();
  for (const fila of filas) {
    if (!fila || typeof fila.area !== 'string' || !fila.area.trim() || fila.area.length > 100 ||
        typeof fila.nombre !== 'string' || !fila.nombre.trim() || fila.nombre.length > 150 ||
        typeof fila.cargo !== 'string' || fila.cargo.length > 80 ||
        !fila.turnos || typeof fila.turnos !== 'object' || Array.isArray(fila.turnos)) {
      return res.status(400).json({ mensaje: 'Hay nombres, áreas o cargos inválidos.' });
    }
    const clave = normalizar(fila.area) + '|' + normalizar(fila.nombre);
    if (claves.has(clave)) return res.status(400).json({ mensaje: 'Un trabajador aparece repetido en la misma área: ' + fila.nombre });
    claves.add(clave);
    for (const [dia, turno] of Object.entries(fila.turnos)) {
      if (!DIAS.includes(dia) || typeof turno !== 'string' || turno.length > 100) {
        return res.status(400).json({ mensaje: 'Hay turnos inválidos en el archivo.' });
      }
    }
  }
  let conexion;
  try {
    conexion = await db.getConnection();
    await conexion.beginTransaction();
    const [areas] = await conexion.query('SELECT id, nombre FROM areas WHERE estado = 1');
    const [trabajadores] = await conexion.query('SELECT id, nombre, area_id FROM trabajadores WHERE estado = 1');
    const mapaAreas = new Map(areas.map(a => [normalizar(a.nombre), a.id]));
    const mapaTrabajadores = new Map();
    for (const t of trabajadores) {
      const clave = normalizar(t.nombre);
      if (!mapaTrabajadores.has(clave)) mapaTrabajadores.set(clave, []);
      mapaTrabajadores.get(clave).push(t);
    }
    let nuevasAreas = 0, nuevosTrabajadores = 0, turnosGuardados = 0;
    for (const fila of filas) {
      const areaClave = normalizar(fila.area);
      let areaId = mapaAreas.get(areaClave);
      if (!areaId) {
        const [creada] = await conexion.query('INSERT INTO areas (nombre) VALUES (?)', [fila.area.trim()]);
        areaId = creada.insertId;
        mapaAreas.set(areaClave, areaId);
        nuevasAreas++;
      }
      const coincidencias = mapaTrabajadores.get(normalizar(fila.nombre)) || [];
      if (coincidencias.length > 1) throw new Error('Nombre ambiguo en la base de datos: ' + fila.nombre);
      let trabajadorId;
      if (coincidencias.length) {
        trabajadorId = coincidencias[0].id;
      } else {
        const [creado] = await conexion.query('INSERT INTO trabajadores (nombre, area_id, cargo) VALUES (?, ?, ?)',
          [fila.nombre.trim(), areaId, fila.cargo.trim() || 'MESERO']);
        trabajadorId = creado.insertId;
        mapaTrabajadores.set(normalizar(fila.nombre), [{ id: trabajadorId, area_id: areaId }]);
        nuevosTrabajadores++;
      }
      // No modificar la asignación histórica de otras semanas.
      for (const [dia, horario] of Object.entries(fila.turnos)) {
        await conexion.query(`INSERT INTO horarios (trabajador_id, area_id, semana_inicio, dia_semana, horario)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE area_id = VALUES(area_id), horario = VALUES(horario)`,
          [trabajadorId, areaId, semana_inicio, dia, horario.trim() || 'LIBRE']);
        turnosGuardados++;
      }
      // Área vigente para que el trabajador aparezca en la planilla de esta semana.
      await conexion.query('UPDATE trabajadores SET area_id = ? WHERE id = ?', [areaId, trabajadorId]);
    }
    await conexion.commit();
    res.json({ mensaje: 'Importación completada', nuevasAreas, nuevosTrabajadores, turnosGuardados });
  } catch (error) {
    if (conexion) await conexion.rollback();
    console.error('Error al importar planilla:', error.message);
    res.status(500).json({ mensaje: error.message.startsWith('Nombre ambiguo') ? error.message : 'No se pudo importar el archivo; no se guardaron cambios.' });
  } finally {
    if (conexion) conexion.release();
  }
});
module.exports = router;
