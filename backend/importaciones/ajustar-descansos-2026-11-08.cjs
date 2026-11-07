const fs=require('fs');
const path=require('path');
const assert=require('node:assert/strict');
require('dotenv').config({path:path.join(__dirname,'../.env'),quiet:true});
const mysql=require('mysql2/promise');
async function main(){
 const db=await mysql.createConnection({host:process.env.DB_HOST,user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,port:process.env.DB_PORT});
 try{
  await db.beginTransaction();
  const [personas]=await db.query('SELECT id,nombre,cargo FROM trabajadores WHERE estado=1 ORDER BY id FOR UPDATE');
  const ids=personas.filter(t=>String(t.cargo).trim().toUpperCase()!=='BARMAN').map(t=>t.id);
  const [antes]=await db.query("SELECT * FROM horarios WHERE semana_inicio='2026-11-09' ORDER BY trabajador_id,dia_semana FOR UPDATE");
  const [otrosAntes]=await db.query("SELECT * FROM horarios WHERE semana_inicio<>'2026-11-09' ORDER BY id");
  const dias=['Domingo','Lunes','Martes','Miercoles','Jueves','Viernes','Sabado'];
  const siete=['6:00 AM - 1:00 PM','7:00 AM - 2:00 PM','8:00 AM - 3:00 PM','11:00 AM - 6:00 PM','1:00 PM - 8:00 PM'];
  const plan=ids.map((id,i)=>{
   const filas=antes.filter(h=>h.trabajador_id===id);assert.equal(filas.length,7);
   const trabajaDomingo=i%2===0;
   const compensatorio=1+(i%6);
   // Del 8 al 14 de noviembre no hay festivos entre semana en Colombia.
   const descanso=trabajaDomingo?-1:0;
   const turnos=dias.map((dia,d)=>({dia_semana:dia,horario:d===descanso?'DESCANSO':trabajaDomingo&&d===compensatorio?'COMPENSATORIO':siete[(i+d)%5]}));
   const horas=turnos.reduce((n,h)=>n+(['DESCANSO','COMPENSATORIO'].includes(h.horario)?0:7),0);
   assert.equal(horas,42);assert.equal(turnos.filter(h=>h.horario==='DESCANSO').length,trabajaDomingo?0:1);assert.ok(turnos.every((h,d)=>h.horario!=='DESCANSO'||d===0));
   assert.equal(turnos.some(h=>h.horario==='COMPENSATORIO'),trabajaDomingo);
   return {trabajador_id:id,nombre:personas.find(t=>t.id===id).nombre,trabajaDomingo,horas,turnos};
  });
  const respaldo=path.join(__dirname,'respaldos','antes-descansos-2026-11-08-'+Date.now()+'.json');fs.writeFileSync(respaldo,JSON.stringify(antes,null,2));
  for(const t of plan)for(const h of t.turnos)await db.query("UPDATE horarios SET horario=? WHERE trabajador_id=? AND semana_inicio='2026-11-09' AND dia_semana=?",[h.horario,t.trabajador_id,h.dia_semana]);
  const [despues]=await db.query("SELECT * FROM horarios WHERE semana_inicio='2026-11-09' ORDER BY trabajador_id,dia_semana");
  for(const t of plan)for(const h of t.turnos){const row=despues.find(r=>r.trabajador_id===t.trabajador_id&&r.dia_semana===h.dia_semana);assert.equal(row.horario,h.horario);const old=antes.find(r=>r.id===row.id);assert.equal(row.area_id,old.area_id);}
  assert.deepEqual(despues.filter(h=>!ids.includes(h.trabajador_id)),antes.filter(h=>!ids.includes(h.trabajador_id)));
  const [otrosDespues]=await db.query("SELECT * FROM horarios WHERE semana_inicio<>'2026-11-09' ORDER BY id");assert.deepEqual(otrosDespues,otrosAntes);
  fs.writeFileSync(path.join(__dirname,'descansos-2026-11-08.json'),JSON.stringify({semana_inicio:'2026-11-09',plan},null,2));
  await db.commit();console.log(JSON.stringify({personas:plan.length,conDomingoYCompensatorio:plan.filter(t=>t.trabajaDomingo).length,conDomingoLibre:plan.filter(t=>!t.trabajaDomingo).length,horas: [...new Set(plan.map(t=>t.horas))],descansoSoloDomingo:true,barmanYOtrasSemanasSinCambios:true,respaldo}));
 }catch(e){await db.rollback();throw e;}finally{await db.end();}
}
main().catch(e=>{console.error(e.code||e.message);process.exitCode=1});
