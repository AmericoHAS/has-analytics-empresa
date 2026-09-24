import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFileSync} from 'node:fs';
export async function runIndependentConsultations({db,as,denied,admin,a,b}) {
 await db.exec('reset role');
 const sql=readFileSync('supabase/CONSULTORIA-INDEPENDENTE.sql','utf8');await db.exec(sql);await db.exec(sql);
 const row=async(sql,args=[]) => (await db.query(sql,args)).rows[0];
 await as(admin);
 const p=(await row(`insert into client_projects(client_id,title,status) values('${a}','Fluxo sem reunião obrigatória','em_andamento') returning id`)).id;
 async function result(revision=null){
   await as(admin);const path=`${a}/${randomUUID()}.pdf`;
   await db.query("insert into storage.objects(bucket_id,name) values('client-documents',$1)",[path]);
   await db.query("insert into client_documents(client_id,project_id,revision_id,title,kind,storage_path,is_visible) values($1,$2,$3,'Resultado final','relatorio',$4,true)",[a,p,revision,path]);
 }
 await denied(`select close_analysis_project('${p}')`);
 await result();await db.exec(`select complete_project_analysis('${p}')`);
 assert.ok((await row(`select analysis_completed_at from client_projects where id='${p}'`)).analysis_completed_at);
 const rev=(await row(`insert into project_revisions(project_id,title,enabled) values('${p}','Revisão antes da consultoria',true) returning id`)).id;
 await denied(`select close_analysis_project('${p}')`);
 await denied(`insert into project_revisions(project_id,title,enabled) values('${p}','Segunda revisão ainda pendente',true)`);
 await result(rev);await db.exec(`select complete_project_analysis('${p}','${rev}')`);
 assert.ok((await row(`select completed_at from project_revisions where id='${rev}'`)).completed_at);
 const rev2=(await row(`insert into project_revisions(project_id,title,enabled) values('${p}','Nova revisão sem reunião',true) returning id`)).id;
 await result(rev2);await db.exec(`select complete_project_analysis('${p}','${rev2}')`);
 await as(a);await denied(`select close_analysis_project('${p}')`);await denied(`select complete_project_analysis('${p}')`);
 await as(admin);await db.exec(`select close_analysis_project('${p}');select close_analysis_project('${p}')`);
 assert.equal((await row(`select status from client_projects where id='${p}'`)).status,'concluido');
 assert.equal((await row(`select count(*)::int n from consultation_bookings where project_id='${p}'`)).n,0);
 assert.equal((await row(`select count(*)::int n from notifications where event_key='project-closed:${p}'`)).n,1);
 const slot=(await row(`insert into consultation_slots(starts_at,ends_at,mode) values(now()+interval '700 days',now()+interval '700 days 1 hour','online') returning id`)).id;
 await as(b);await denied(`select book_consultation('${slot}','${p}')`);
 await as(a);assert.equal((await row(`select consultation_released('${p}') ok`)).ok,true);await db.exec(`select book_consultation('${slot}','${p}')`);
 await as(admin);
 const booking=await row(`select id,status from consultation_bookings where project_id='${p}'`);
 assert.equal(booking.status,'solicitado');
 // A later review can be completed while the original consultation is booked.
 const rev3=(await row(`insert into project_revisions(project_id,title,enabled) values('${p}','Revisão com reunião pendente',true) returning id`)).id;
 await result(rev3);await db.exec(`select complete_project_analysis('${p}','${rev3}');select close_analysis_project('${p}')`);
 assert.equal((await row(`select status from client_projects where id='${p}'`)).status,'concluido');
 assert.equal((await row(`select status from consultation_bookings where id='${booking.id}'`)).status,'solicitado');
 await denied(`select archive_analysis_project('${p}')`); // archived projects would hide active meetings
 console.log('PASS independent consultation: analysis, revisions and project close without meeting; pending bookings preserved; scheduling after closure; permissions and open revision guards retained');
}
