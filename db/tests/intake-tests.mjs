// Integration tests use the real runtime login. All workflow changes roll back.
import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import pg from 'pg';
import dotenv from 'dotenv';
import {fileURLToPath} from 'node:url';
dotenv.config({path:fileURLToPath(new URL('../../.env.local',import.meta.url))});
const owner=new pg.Client({connectionString:process.env.DATABASE_URL_DIRECT});
const web=new pg.Client({connectionString:process.env.DATABASE_URL});
const tag='intake_test_'+randomBytes(6).toString('hex');
const users={};let count=0;
const pass=name=>{console.log(`PASS ${++count}: ${name}`);};
async function actor(name,roleOverride){
 await web.query('RESET ROLE');
 const id=users[name]?.id;const xid=(await web.query('SELECT txid_current()::text AS id')).rows[0].id;
 const signature=id?createHmac('sha256',process.env.DATABASE_CONTEXT_SECRET).update(`${id}:${xid}`).digest('hex'):'';
 await web.query("SELECT set_config('app.current_user_id',$1,true),set_config('app.context_signature',$2,true)",[id?String(id):'',signature]);
 const role=roleOverride??users[name]?.role??'guest';assert(['foster','staff','admin','adopter','guest'].includes(role));
 await web.query(`SET LOCAL ROLE pfa_${role}`);
}
async function fails(sql,args,code){
 await web.query('SAVEPOINT expected_failure');
 try {await assert.rejects(()=>web.query(sql,args),e=>e.code===code);}
 finally {await web.query('ROLLBACK TO SAVEPOINT expected_failure');await web.query('RELEASE SAVEPOINT expected_failure');}
}
const details={name:tag,species:'dog',sex:'unknown',size:'small',ageMonths:12,weightKg:4,energyLevel:3,foundLocation:'Test location',foundDate:'2020-01-01',temporarilyCaring:true,healthNotes:'Needs examination',vaccineNotes:'Unknown',description:'Test report'};
try {
 assert(process.env.DATABASE_CONTEXT_SECRET&&process.env.DATABASE_URL_DIRECT&&process.env.DATABASE_URL,'Configure database RBAC first');
 await owner.connect();await web.connect();
 const role=(await web.query('SELECT rolsuper OR rolbypassrls OR rolinherit AS unsafe FROM pg_roles WHERE rolname=current_user')).rows[0];assert.equal(role.unsafe,false,'Use restricted DATABASE_URL');
 await owner.query('BEGIN');
 for(const [name,role,approved] of [['foster1','foster',true],['foster2','foster',true],['pending','foster',false],['staff','staff',true],['adopter','adopter',true],['admin','admin',true]]){
 const u=(await owner.query("INSERT INTO users(email,password_hash,full_name,role_id,is_approved) VALUES($1,'not-a-login-password',$2,(SELECT id FROM roles WHERE name=$3),$4) RETURNING id",[`${tag}_${name}@example.test`,tag+' '+name,role,approved])).rows[0];users[name]={id:u.id,role};
 }
 await owner.query('COMMIT');await web.query('BEGIN');
 await actor('foster1');
 const id=(await web.query('SELECT app_security.submit_intake($1::jsonb) AS id',[JSON.stringify(details)])).rows[0].id;
 pass('Approved foster submits an intake with unknown vaccinations');
 assert.equal((await web.query('SELECT * FROM intake_requests WHERE id=$1',[id])).rowCount,1);pass('Foster sees own request');
 await fails("UPDATE intake_requests SET status='approved' WHERE id=$1",[id],'42501');pass('Direct request modification is denied');
 await fails("INSERT INTO intake_events(request_id,actor_name,status,details) VALUES($1,'Fake','approved','{}')",[id],'42501');pass('Forged history is denied');
 await fails('SELECT app_security.review_intake($1,\'approved\',\'fake\')',[id],'42501');pass('Foster cannot approve');
 await fails('SELECT app_security.submit_intake($1::jsonb,$2)',[JSON.stringify(details),id],'PT001');pass('Pending requests cannot be overwritten');
 await fails('SELECT app_security.submit_intake($1::jsonb)',[JSON.stringify({...details,weightKg:-1})],'23514');pass('Database validates report data');
 await actor('foster2');assert.equal((await web.query('SELECT * FROM intake_requests WHERE id=$1',[id])).rowCount,0);assert.equal((await web.query('SELECT * FROM intake_events WHERE request_id=$1',[id])).rowCount,0);pass('Other foster cannot read request or history');
 await fails('SELECT app_security.submit_intake($1::jsonb,$2)',[JSON.stringify(details),id],'PT005');pass('Other foster cannot resubmit request');
 await actor('pending');await fails('SELECT app_security.submit_intake($1::jsonb)',[JSON.stringify(details)],'42501');pass('Unapproved foster cannot submit');
 await actor('adopter');await fails('SELECT * FROM intake_requests',[],'42501');pass('Adopter cannot read private intake reports');
 await actor('foster1','staff');await fails('SELECT app_security.review_intake($1,\'approved\',\'forged role\')',[id],'42501');pass('SQL role switching cannot bypass signed identity');
 await actor('staff');assert.equal((await web.query('SELECT * FROM intake_requests WHERE id=$1',[id])).rowCount,1);pass('Staff can inspect request');
 await fails('SELECT app_security.review_intake($1,\'rejected\',\'\')',[id],'23514');pass('Review requires a reason');
 await web.query('SELECT app_security.review_intake($1,\'needs_information\',\'Please clarify health observations\')',[id]);
 await actor('foster1');await web.query('SELECT app_security.submit_intake($1::jsonb,$2)',[JSON.stringify({...details,healthNotes:'Vet examination requested'}),id]);pass('Foster can revise and resubmit after staff feedback');
 await actor('staff');const pet=(await web.query('SELECT app_security.review_intake($1,\'approved\',\'Accepted for assessment; verify vaccinations\') AS id',[id])).rows[0].id;
 assert.equal((await web.query('SELECT status FROM pets WHERE id=$1',[pet])).rows[0].status,'intake');pass('Approval creates an intake pet, not an available pet');
 assert.equal((await web.query('SELECT * FROM vaccinations WHERE pet_id=$1',[pet])).rowCount,0);pass('Unverified vaccination claims are not imported');
 assert.equal((await web.query('SELECT * FROM foster_placements WHERE pet_id=$1',[pet])).rowCount,0);pass('No automatic foster assignment');
 await fails('SELECT app_security.review_intake($1,\'approved\',\'repeat approval\')',[id],'PT001');pass('Duplicate approval blocked');
 await fails("SELECT sp_change_pet_status($1,'available','test',$2)",[pet,users.staff.id],'PT002');pass('Existing vaccination gate blocks availability');
 await actor('foster1');assert.equal((await web.query('SELECT * FROM intake_events WHERE request_id=$1',[id])).rowCount,4);pass('Submission, feedback, revision and approval preserved');
 await fails('SELECT app_security.submit_intake($1::jsonb,$2)',[JSON.stringify(details),id],'PT001');pass('Approved request is immutable');
 const rejected=(await web.query('SELECT app_security.submit_intake($1::jsonb) AS id',[JSON.stringify(details)])).rows[0].id;
 await actor('staff');await web.query("SELECT app_security.review_intake($1,'rejected','Duplicate report')",[rejected]);
 const row=(await web.query('SELECT status,pet_id FROM intake_requests WHERE id=$1',[rejected])).rows[0];assert.equal(row.status,'rejected');assert.equal(row.pet_id,null);pass('Rejected report creates no pet');
 await actor('admin');assert((await web.query("SELECT * FROM audit_log WHERE table_name='intake_requests' AND record_id=$1",[String(id)])).rowCount>=4);pass('Admin audit includes intake changes');
 await actor(null);await fails('SELECT * FROM intake_requests',[],'42501');assert.equal((await web.query('SELECT * FROM pets WHERE id=$1',[pet])).rowCount,0);pass('Guest cannot see private requests or intake pets');
 await web.query('ROLLBACK');console.log(`\n${count} intake checks passed. Workflow records rolled back.`);
}catch(e){console.error('INTAKE TEST FAILED:',e);process.exitCode=1;}
finally{
 try{await web.query('ROLLBACK');}catch{}
 try{
  await owner.query('ROLLBACK');await owner.query('BEGIN');
  await owner.query('DELETE FROM users WHERE id=ANY($1::int[])',[Object.values(users).map(u=>u.id)]);
  await owner.query("DELETE FROM audit_log WHERE old_data->>'full_name' LIKE $1 OR new_data->>'full_name' LIKE $1",[tag+'%']);
  await owner.query('COMMIT');
 }catch(e){console.error('Cleanup failed:',e.message);process.exitCode=1;}
 await web.end();await owner.end();
}
