// Integration tests against the real restricted login, not the schema owner.
// Creates uniquely named fixtures, rolls back every tested workflow and cleans up.
import assert from 'node:assert/strict';
import {createHmac,randomBytes} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import pg from 'pg';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config({path:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../.env.local')});
const owner=new pg.Client({connectionString:process.env.DATABASE_URL_DIRECT});
const web=new pg.Client({connectionString:process.env.DATABASE_URL});
const key=process.env.DATABASE_CONTEXT_SECRET;
const tag='rbac_'+randomBytes(6).toString('hex');
const users={},pets={},apps={};let count=0;let fixtures=false;
const ok=(name)=>{count++;console.log(`PASS ${String(count).padStart(2,'0')} ${name}`);};
async function denied(sql,args=[]) {
 await web.query('SAVEPOINT denial');
 try {await web.query(sql,args);throw new Error('Expected PostgreSQL permission denial but query succeeded: '+sql);}
 catch(e) {if(e.code!=='42501') throw e;}
 finally {await web.query('ROLLBACK TO SAVEPOINT denial');await web.query('RELEASE SAVEPOINT denial');}
}
async function tx(who,fn) {
 await web.query('BEGIN');
 try {
  const xid=(await web.query('SELECT txid_current()::text AS xid')).rows[0].xid;
  const uid=who?users[who].id:null;
  const sig=uid?createHmac('sha256',key).update(`${uid}:${xid}`).digest('hex'):'';
  await web.query("SELECT set_config('app.current_user_id',$1,true),set_config('app.context_signature',$2,true)",[uid?String(uid):'',sig]);
  const role=(await web.query('SELECT app_security.actor_role() AS role')).rows[0].role;
  assert(['guest','adopter','foster','staff','admin'].includes(role));
  await web.query(`SET LOCAL ROLE pfa_${role}`);
  await fn();
 } finally {await web.query('ROLLBACK');}
}
try {
 if(!key||!process.env.DATABASE_URL_DIRECT||!process.env.DATABASE_URL) throw new Error('Run migrations and db:rbac:setup first.');
 await owner.connect();await web.connect();
 const who=(await web.query('SELECT current_user AS name')).rows[0].name;
 const privileged=(await web.query("SELECT rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolinherit AS bad FROM pg_roles WHERE rolname=current_user")).rows[0].bad;
 assert(!privileged,'Tests must use the restricted runtime login');
 assert.notEqual(who,(await owner.query('SELECT current_user AS name')).rows[0].name);
 await owner.query('BEGIN');
 await owner.query("SELECT set_config('app.seed_mode','on',true)");
 const hash=await bcrypt.hash('RbacTest@12345',10);
 for(const [name,role,approved] of [['admin','admin',true],['staff','staff',true],['adopter1','adopter',true],['adopter2','adopter',true],['foster1','foster',true],['foster2','foster',true],['pending','foster',false]]) {
  const u=(await owner.query(`INSERT INTO users(email,password_hash,full_name,role_id,is_approved) VALUES($1,$2,$3,(SELECT id FROM roles WHERE name=$4),$5) RETURNING id,email`,[`${tag}_${name}@example.test`,hash,tag+' '+name,role,approved])).rows[0];users[name]=u;
  if(role==='foster') await owner.query('INSERT INTO foster_profiles(user_id,max_capacity) VALUES($1,3)',[u.id]);
  if(role==='adopter') await owner.query('INSERT INTO adopter_profiles(user_id,lifestyle_text) VALUES($1,$2)',[u.id,tag]);
 }
 for(const [name,status] of [['available','available'],['other','available'],['placed','in_foster'],['adopted','adopted'],['intake','intake']]) {
  pets[name]=(await owner.query(`INSERT INTO pets(name,species,sex,age_months,size,weight_kg,status) VALUES($1,'dog','male',24,'small',5,$2) RETURNING id`,[tag+' '+name,status])).rows[0].id;
 }
 const placement=(await owner.query('INSERT INTO foster_placements(pet_id,foster_user_id,created_by) VALUES($1,$2,$3) RETURNING id',[pets.placed,users.foster1.id,users.staff.id])).rows[0].id;
 for(const [name,pet,user,status] of [['own',pets.available,users.adopter1.id,'submitted'],['other',pets.other,users.adopter2.id,'submitted'],['adopted',pets.adopted,users.adopter1.id,'approved']]) {
  apps[name]=(await owner.query('INSERT INTO applications(pet_id,adopter_user_id,status) VALUES($1,$2,$3) RETURNING id',[pet,user,status])).rows[0].id;
 }
 const adoption=(await owner.query('INSERT INTO adoptions(pet_id,application_id,adopter_user_id,approved_by) VALUES($1,$2,$3,$4) RETURNING id',[pets.adopted,apps.adopted,users.adopter1.id,users.staff.id])).rows[0].id;
 const followup=(await owner.query('SELECT id FROM followups WHERE adoption_id=$1 ORDER BY id LIMIT 1',[adoption])).rows[0].id;
 await owner.query('INSERT INTO medical_records(pet_id,record_type,diagnosis) VALUES($1,\'checkup\',$2)',[pets.placed,tag]);
 await owner.query('COMMIT');fixtures=true;

 await tx(null,async()=>{
  assert.equal((await web.query('SELECT id FROM pets WHERE id=$1',[pets.available])).rowCount,1);ok('Guest can browse an available pet');
  assert.equal((await web.query('SELECT id FROM pets WHERE id=$1',[pets.intake])).rowCount,0);ok('Guest cannot read intake pets');
  await denied('SELECT * FROM applications');ok('Guest cannot read applications');
  await denied('SELECT password_hash FROM users');ok('Password hashes are not exposed');
  await denied('SELECT * FROM app_security.context_key');ok('Identity signing key is not exposed');
  await denied('INSERT INTO pets(name,species,sex,age_months,size) VALUES(\'bad\',\'dog\',\'male\',1,\'small\')');ok('Guest cannot create pets');
  const login=(await web.query('SELECT * FROM app_security.login($1,$2)',[users.adopter1.email,'RbacTest@12345'])).rows[0];assert.equal(login.id,users.adopter1.id);ok('Existing bcryptjs passwords authenticate in PostgreSQL');
  assert.equal((await web.query('SELECT * FROM app_security.login($1,$2)',[users.adopter1.email,'wrong'])).rowCount,0);ok('Wrong password rejected');
  await denied('SELECT app_security.register($1,$2,$3,NULL,\'admin\')',[tag+'evil@example.test',hash,'Bad Admin']);ok('Registration cannot create an admin');
  const registered=(await web.query('SELECT app_security.register($1,$2,$3,NULL,\'foster\') AS id',[tag+'new@example.test',hash,'New Foster'])).rows[0].id;assert(registered>0);ok('Restricted foster registration succeeds');
  await web.query('SET LOCAL ROLE pfa_admin');
  assert.equal((await web.query('SELECT id FROM users')).rowCount,0);ok('Switching SQL role without a signed identity grants no user data');
 });
 await tx('adopter1',async()=>{
  const ids=(await web.query('SELECT id FROM applications')).rows.map(r=>r.id);assert(ids.includes(apps.own));assert(!ids.includes(apps.other));ok('Adopter sees only own applications even without WHERE');
  assert.equal((await web.query('SELECT * FROM adopter_profiles WHERE user_id=$1',[users.adopter2.id])).rowCount,0);ok('Adopter cannot read another profile');
  await denied('UPDATE users SET role_id=(SELECT id FROM roles WHERE name=\'admin\') WHERE id=$1',[users.adopter1.id]);ok('Adopter cannot self-promote');
  await denied('UPDATE applications SET status=\'approved\' WHERE id=$1',[apps.own]);ok('Adopter cannot approve own application');
  await denied('SELECT approve_adoption($1,$2)',[apps.own,users.adopter1.id]);ok('Adopter cannot execute approval workflow');
  await denied('INSERT INTO medical_records(pet_id,record_type) VALUES($1,\'checkup\')',[pets.available]);ok('Adopter cannot insert medical records');
  await denied('INSERT INTO adopter_profiles(user_id) VALUES($1)',[users.staff.id]);ok('Adopter cannot create a profile for another user');
  assert.equal((await web.query('UPDATE adopter_profiles SET lifestyle_text=\'updated\' WHERE user_id=$1',[users.adopter1.id])).rowCount,1);ok('Adopter can edit own profile');
  assert.equal((await web.query('SELECT * FROM app_security.submit_application($1,\'test\')',[pets.other])).rowCount,1);ok('Adopter can submit a valid application');
  assert.equal((await web.query('SELECT * FROM app_security.submit_application($1,\'duplicate\')',[pets.available])).rowCount,0);ok('Duplicate pending application is not overwritten');
  assert.equal((await web.query("UPDATE followups SET status='completed',adopter_notes='good',completed_at=now() WHERE id=$1",[followup])).rowCount,1);ok('Adopter can complete own follow-up');
  await denied('UPDATE followups SET adoption_id=$1 WHERE id=$2',[adoption,followup]);ok('Adopter cannot reassign follow-up ownership');
  await web.query('SET LOCAL ROLE pfa_admin');
  assert.equal((await web.query('UPDATE users SET is_active=false WHERE id=$1',[users.adopter2.id])).rowCount,0);ok('Role switching cannot bypass RLS');
  await denied('SELECT approve_adoption($1,$2)',[apps.own,users.admin.id]);ok('Forged reviewer ID cannot approve an adoption');
 });
 await tx('adopter2',async()=>{
  assert.equal((await web.query('SELECT id FROM followups WHERE id=$1',[followup])).rowCount,0);ok('Other adopter cannot read follow-up');
  assert.equal((await web.query("UPDATE followups SET status='completed',completed_at=now() WHERE id=$1",[followup])).rowCount,0);ok('Other adopter cannot complete follow-up');
 });
 await tx('foster1',async()=>{
  assert.equal((await web.query('SELECT id FROM foster_placements WHERE id=$1',[placement])).rowCount,1);ok('Foster sees own placement');
  assert.equal((await web.query('SELECT id FROM medical_records WHERE pet_id=$1',[pets.placed])).rowCount,1);ok('Foster can read assigned pet medical records');
  assert.equal((await web.query('INSERT INTO foster_updates(placement_id,created_by,health_note) VALUES($1,$2,\'well\') RETURNING id',[placement,users.foster1.id])).rowCount,1);ok('Approved foster can log own placement update');
  await denied('INSERT INTO foster_updates(placement_id,created_by) VALUES($1,$2)',[placement,users.staff.id]);ok('Foster cannot forge update author');
  await denied('UPDATE users SET is_approved=true WHERE id=$1',[users.foster1.id]);ok('Foster cannot change approval status');
 });
 await tx('foster2',async()=>{
  assert.equal((await web.query('SELECT id FROM foster_placements WHERE id=$1',[placement])).rowCount,0);ok('Foster cannot see another placement');
  assert.equal((await web.query('SELECT id FROM medical_records WHERE pet_id=$1',[pets.placed])).rowCount,0);ok('Foster cannot read another placement medical records');
  await denied('INSERT INTO foster_updates(placement_id,created_by) VALUES($1,$2)',[placement,users.foster2.id]);ok('Foster cannot update another placement');
 });
 await tx('pending',async()=>{
  await denied('INSERT INTO foster_updates(placement_id,created_by) VALUES($1,$2)',[placement,users.pending.id]);ok('Unapproved foster cannot post updates');
 });
 await tx('staff',async()=>{
  assert.equal((await web.query('UPDATE users SET is_approved=true WHERE id=$1',[users.pending.id])).rowCount,1);ok('Staff can approve a foster');
  await denied('UPDATE users SET role_id=(SELECT id FROM roles WHERE name=\'admin\') WHERE id=$1',[users.staff.id]);ok('Staff cannot grant admin privileges');
  await denied('SELECT * FROM audit_log');ok('Staff cannot read admin audit log');
  const adopted=(await web.query('SELECT approve_adoption($1,$2) AS id',[apps.own,users.staff.id])).rows[0].id;assert(adopted>0);ok('Staff adoption approval succeeds with all RLS policies active');
  assert.equal((await web.query('SELECT count(*)::int AS n FROM followups WHERE adoption_id=$1',[adopted])).rows[0].n,3);ok('Approval generates three follow-ups');
  await web.query('SELECT sp_change_pet_status($1,\'medical_hold\',\'test\',$2)',[pets.intake,users.staff.id]);ok('Staff can perform a valid lifecycle transition');
  await denied('SELECT sp_change_pet_status($1,\'intake\',NULL,$2)',[pets.intake,users.admin.id]);ok('Workflow rejects spoofed actor');
  const newPlacement=(await web.query('SELECT sp_place_in_foster($1,$2,NULL,$3) AS id',[pets.other,users.foster2.id,users.staff.id])).rows[0].id;assert(newPlacement>0);ok('Staff can place a pet into foster care');
  await web.query('SELECT sp_end_placement($1,\'adopted\',$2)',[newPlacement,users.staff.id]);ok('Staff can end placement');
  await web.query('SELECT sp_process_return($1,\'test return\',$2)',[pets.adopted,users.staff.id]);ok('Staff can process adoption return');
  for(const v of ['v_foster_capacity','v_overdue_vaccinations','v_at_risk_pets','v_pet_timeline','v_adoption_funnel','v_average_stay_by_species']) await web.query('SELECT * FROM '+v+' LIMIT 2');ok('Staff reporting views work under invoker permissions');
  await web.query("SELECT set_config('app.seed_mode','on',true)");
  await web.query('SAVEPOINT seed_attempt');let blocked=false;
  try {await web.query("INSERT INTO pets(name,species,sex,age_months,size,status) VALUES('bad','dog','male',1,'small','adopted')");} catch(e) {assert.equal(e.code,'PT001');blocked=true;}finally{await web.query('ROLLBACK TO SAVEPOINT seed_attempt');}
  assert(blocked);ok('Runtime cannot activate maintenance seed bypass');
 });
 await tx('admin',async()=>{
  assert((await web.query('SELECT id FROM audit_log WHERE table_name=\'users\' AND record_id=$1',[String(users.adopter1.id)])).rowCount>0);ok('Admin can read audit records');
  await denied('DELETE FROM audit_log');ok('Admin app role cannot delete audit records');
  await denied('INSERT INTO audit_log(table_name,record_id,action) VALUES(\'pets\',\'1\',\'INSERT\')');ok('Admin app role cannot forge audit history');
 });
 await tx('adopter1',async()=>{
  await web.query("SELECT set_config('app.current_user_id',$1,true)",[String(users.admin.id)]);
  assert.equal((await web.query('SELECT app_security.actor_id() AS id')).rows[0].id,null);ok('Changing actor ID invalidates signature');
 });
 await tx('adopter1',async()=>{
  const signature=(await web.query("SELECT current_setting('app.context_signature') AS s")).rows[0].s;
  await web.query('COMMIT');await web.query('BEGIN');
  await web.query("SELECT set_config('app.current_user_id',$1,true),set_config('app.context_signature',$2,true)",[String(users.adopter1.id),signature]);
  assert.equal((await web.query('SELECT app_security.actor_id() AS id')).rows[0].id,null);ok('Signed context cannot be replayed in a different transaction');
 });
 await owner.query('UPDATE users SET is_active=false WHERE id=$1',[users.adopter1.id]);
 await tx('adopter1',async()=>{assert.equal((await web.query('SELECT app_security.actor_role() AS role')).rows[0].role,'guest');ok('Deactivated users lose database identity');});
 await web.query('BEGIN');await web.query('SET LOCAL ROLE pfa_adopter');
 assert.equal((await web.query('SELECT id FROM applications')).rowCount,0);ok('Pooled connection retains no previous user context');await web.query('ROLLBACK');
 console.log(`\n${count} RBAC integration checks passed using actual runtime login ${who}.`);
} catch(e) {console.error('RBAC TEST FAILED:',e.message);process.exitCode=1;}
finally {
 try {await web.query('ROLLBACK');} catch {}
 try {
  await owner.query('ROLLBACK');
  if(fixtures) {
   await owner.query('BEGIN');
   const ids=Object.values(users).map(u=>u.id),pids=Object.values(pets);
   await owner.query('DELETE FROM followups WHERE adoption_id IN (SELECT id FROM adoptions WHERE pet_id=ANY($1::int[]))',[pids]);
   await owner.query('DELETE FROM adoptions WHERE pet_id=ANY($1::int[])',[pids]);
   await owner.query('DELETE FROM applications WHERE pet_id=ANY($1::int[])',[pids]);
   await owner.query('DELETE FROM foster_placements WHERE pet_id=ANY($1::int[])',[pids]);
   await owner.query('DELETE FROM pets WHERE id=ANY($1::int[])',[pids]);
   await owner.query('DELETE FROM users WHERE id=ANY($1::int[])',[ids]);
   // Audit entries for fixtures only, including the cleanup operations above.
   await owner.query(`DELETE FROM audit_log WHERE actor_user_id=ANY($1::int[]) OR old_data->>'full_name' LIKE $2 OR new_data->>'full_name' LIKE $2 OR old_data->>'name' LIKE $2 OR new_data->>'name' LIKE $2 OR old_data->>'diagnosis'=$3 OR new_data->>'diagnosis'=$3 OR (table_name='foster_placements' AND (old_data->>'pet_id'=ANY($4::text[]) OR new_data->>'pet_id'=ANY($4::text[]))) OR (table_name='foster_profiles' AND (old_data->>'user_id'=ANY($5::text[]) OR new_data->>'user_id'=ANY($5::text[])))`,[ids,tag+'%',tag,pids.map(String),ids.map(String)]);
   await owner.query('COMMIT');console.log('Temporary test records cleaned up.');
  }
 } catch(e){console.error('Fixture cleanup failed:',e.message);process.exitCode=1;}
 await web.end();await owner.end();
}
