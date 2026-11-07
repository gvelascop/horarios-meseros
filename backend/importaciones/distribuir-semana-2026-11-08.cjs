const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
const mysql = require('mysql2/promise');
async function main() {
 const db=await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,port:process.env.DB_PORT});
 try {
  await db.beginTransaction();
  const [areas]=await db.query('SELECT id,nombre FROM areas WHERE estado=1 ORDER BY id');
  assert.ok(areas.length>1);
  const [trabajadores]=await db.query('SELECT id,nombre,cargo,area_id FROM trabajadores WHERE estado=1 ORDER BY id FOR UPDATE');
  const [previos]=await db.query("SELECT * FROM horarios WHERE semana_inicio='2026-11-02' ORDER BY id");
  const [existentes]=await db.query("SELECT * FROM horarios WHERE semana_inicio='2026-11-09' ORDER BY id FOR UPDATE");
  const [otrosAntes]=await db.query("SELECT * FROM horarios WHERE semana_inicio<>'2026-11-09' ORDER BY id");
  const esBarman=t=>String(t.cargo).trim().toUpperCase()==='BARMAN';
  const protegidos=trabajadores.filter(esBarman);
  const elegidos=trabajadores.filter(t=>!esBarman(t));
  const cuenta=new Map(areas.map(a=>[a.id,0]));
  for (const t of protegidos) cuenta.set(t.area_id,(cuenta.get(t.area_id)||0)+1);
  const dias=['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'];
  const turnos=['6:00 AM - 2:00 PM','7:00 AM - 3:00 PM','8:00 AM - 4:00 PM','10:00 AM - 6:00 PM','12:00 PM - 8:00 PM','1:00 PM - 9:00 PM'];
  const plan=elegidos.map((t,i)=>{
   const anterior=previos.find(h=>h.trabajador_id===t.id)?.area_id;
   const actual=existentes.find(h=>h.trabajador_id===t.id)?.area_id;
   const candidatas=areas.filter(a=>a.id!==t.area_id&&a.id!==anterior&&a.id!==actual).sort((a,b)=>cuenta.get(a.id)-cuenta.get(b.id)||a.id-b.id);
   assert.ok(candidatas.length);
   const area=candidatas[0];cuenta.set(area.id,cuenta.get(area.id)+1);
   return {trabajador_id:t.id,nombre:t.nombre,area_id:area.id,area:area.nombre,horarios:dias.map((dia,d)=>({dia_semana:dia,horario:turnos[(i+d)%turnos.length]}))};
  });
  const respaldo=path.join(__dirname,'respaldos','antes-distribucion-2026-11-08-'+Date.now()+'.json');
  fs.mkdirSync(path.dirname(respaldo),{recursive:true});
  fs.writeFileSync(respaldo,JSON.stringify({semana_inicio:'2026-11-09',trabajadores,horarios:existentes},null,2));
  fs.writeFileSync(path.join(__dirname,'distribucion-2026-11-08.json'),JSON.stringify({inicio:'2026-11-08',fin:'2026-11-14',semana_inicio:'2026-11-09',plan},null,2));
  for(const t of plan) for(const h of t.horarios) {
   await db.query('INSERT INTO horarios (trabajador_id,area_id,semana_inicio,dia_semana,horario) VALUES (?,?,?, ?,?) ON DUPLICATE KEY UPDATE area_id=VALUES(area_id),horario=VALUES(horario)',[t.trabajador_id,t.area_id,'2026-11-09',h.dia_semana,h.horario]);
  }
  const [despues]=await db.query("SELECT * FROM horarios WHERE semana_inicio='2026-11-09' ORDER BY id");
  for(const t of plan){const rows=despues.filter(h=>h.trabajador_id===t.trabajador_id);assert.equal(rows.length,7);for(const h of t.horarios){const row=rows.find(r=>r.dia_semana===h.dia_semana);assert.equal(row.area_id,t.area_id);assert.equal(row.horario,h.horario);}}
  const idsProtegidos=new Set(protegidos.map(t=>t.id));
  assert.deepEqual(despues.filter(h=>idsProtegidos.has(h.trabajador_id)),existentes.filter(h=>idsProtegidos.has(h.trabajador_id)));
  const [otrosDespues]=await db.query("SELECT * FROM horarios WHERE semana_inicio<>'2026-11-09' ORDER BY id");assert.deepEqual(otrosDespues,otrosAntes);
  const [personasDespues]=await db.query('SELECT id,nombre,cargo,area_id FROM trabajadores WHERE estado=1 ORDER BY id');assert.deepEqual(personasDespues,trabajadores);
  await db.commit();
  console.log(JSON.stringify({personasDistribuidas:plan.length,turnosVerificados:plan.length*7,barmanSinCambios:protegidos.map(t=>t.nombre),otrasSemanasSinCambios:true,distribucion:areas.map(a=>({area:a.nombre,personas:cuenta.get(a.id)})),respaldo}));
 } catch(error){await db.rollback();throw error;} finally{await db.end();}
}
main().catch(error=>{console.error(error.code||error.message);process.exitCode=1});
