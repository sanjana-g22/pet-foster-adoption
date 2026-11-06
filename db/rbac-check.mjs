import path from 'node:path';
import {fileURLToPath} from 'node:url';
import dotenv from 'dotenv';
import pg from 'pg';
dotenv.config({path:path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../.env.local')});
const client=new pg.Client({connectionString:process.env.DATABASE_URL});
try {
 if(!process.env.DATABASE_URL || !process.env.DATABASE_CONTEXT_SECRET) throw new Error('Run npm run db:rbac:setup first.');
 await client.connect();
 const {rows:[r]}=await client.query(`SELECT current_user AS login,rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit FROM pg_roles WHERE rolname=current_user`);
 if(r.rolsuper||r.rolbypassrls||r.rolcreatedb||r.rolcreaterole||r.rolinherit) throw new Error('DATABASE_URL is privileged.');
 const {rows:tables}=await client.query(`SELECT c.relname,c.relrowsecurity,pg_has_role(session_user,c.relowner,'MEMBER') AS owner_access
 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r'
 AND c.relname NOT IN ('schema_migrations','demo_scratch') ORDER BY c.relname`);
 if(tables.some(t=>!t.relrowsecurity||t.owner_access)) throw new Error('A business table lacks RLS or is owned by the runtime login.');
 const {rows:views}=await client.query(`SELECT relname,reloptions FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='v'`);
 if(views.some(v=>!v.reloptions?.includes('security_invoker=true'))) throw new Error('A view does not use caller permissions.');
 console.table(tables.map(t=>({table:t.relname,RLS:t.relrowsecurity,owner_access:t.owner_access})));
 console.log(`PASS: ${r.login} is restricted; ${tables.length} tables enforce RLS; views use caller permissions.`);
} catch(e) {console.error('CHECK FAILED:',e.message);process.exitCode=1;} finally {await client.end();}
