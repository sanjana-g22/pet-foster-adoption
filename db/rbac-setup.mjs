// One-time owner operation. Never use owner credentials in src/ or the web pool.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import dotenv from 'dotenv';
import pg from 'pg';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const envPath=path.join(root,'.env.local');
dotenv.config({path:envPath});
const ownerUrl=process.env.DATABASE_URL_DIRECT;
const quoteId=(v)=>'"'+v.replaceAll('"','""')+'"';
const quoteLiteral=(v)=>"'"+v.replaceAll("'","''")+"'";
const client=new pg.Client({connectionString:ownerUrl});
try {
 if(!ownerUrl) throw new Error('Set DATABASE_URL_DIRECT to the schema-owner connection in .env.local first.');
 await client.connect();
 const version=Number((await client.query('SHOW server_version_num')).rows[0].server_version_num);
 if(version<150000) throw new Error('PostgreSQL 15 or later is required.');
 const migration=await client.query("SELECT to_regclass('app_security.context_key') AS ready");
 if(!migration.rows[0].ready) throw new Error('Run npm run db:migrate first.');
 await client.query('BEGIN');
 // Lock the key table so two setup runs cannot install different keys.
 await client.query('LOCK TABLE app_security.context_key IN EXCLUSIVE MODE');
 let key=(await client.query('SELECT secret FROM app_security.context_key WHERE singleton')).rows[0]?.secret;
 if(!key) {
  key=randomBytes(48).toString('hex');
  await client.query('INSERT INTO app_security.context_key(singleton,secret) VALUES(true,$1)',[key]);
 }
 const login=process.env.PFA_DB_LOGIN || `pfa_web_${randomBytes(6).toString('hex')}`;
 if(!/^pfa_web_[a-z0-9_]{1,40}$/.test(login)) throw new Error('PFA_DB_LOGIN must start pfa_web_ and contain only lowercase letters, digits or underscores.');
 const existing=(await client.query('SELECT * FROM pg_roles WHERE rolname=$1',[login])).rows[0];
 if(existing && (existing.rolsuper || existing.rolbypassrls || existing.rolcreatedb || existing.rolcreaterole || existing.rolinherit)) throw new Error('Existing runtime role is privileged; choose a new PFA_DB_LOGIN.');
 const oldUrl=process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
 const password=existing && oldUrl && decodeURIComponent(oldUrl.username)===login ? decodeURIComponent(oldUrl.password) : randomBytes(32).toString('base64url');
 if(!password) throw new Error('Empty runtime password is not allowed.');
 if(!existing) await client.query(`CREATE ROLE ${quoteId(login)} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS PASSWORD ${quoteLiteral(password)}`);
 else await client.query(`ALTER ROLE ${quoteId(login)} PASSWORD ${quoteLiteral(password)}`);
 const db=(await client.query('SELECT current_database() AS name')).rows[0].name;
 await client.query(`GRANT CONNECT ON DATABASE ${quoteId(db)} TO ${quoteId(login)}`);
 await client.query(`GRANT pfa_guest,pfa_adopter,pfa_foster,pfa_staff,pfa_admin TO ${quoteId(login)}`);
 await client.query(`GRANT USAGE ON SCHEMA app_security TO ${quoteId(login)}`);
 await client.query(`GRANT EXECUTE ON FUNCTION app_security.actor_id(),app_security.actor_role() TO ${quoteId(login)}`);
 const unsafe=(await client.query(`SELECT EXISTS(SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
   WHERE n.nspname IN ('public','app_security') AND pg_has_role($1,c.relowner,'MEMBER')) AS unsafe`,[login])).rows[0].unsafe;
 if(unsafe) throw new Error('Runtime role is a member of an object owner; refusing setup.');
 await client.query('COMMIT');
 const runtimeUrl=new URL(ownerUrl);runtimeUrl.username=login;runtimeUrl.password=password;
 // A direct URL works with local PostgreSQL and hosted PostgreSQL (including Neon).
 const test=new pg.Client({connectionString:runtimeUrl.toString()});
 try {await test.connect();await test.query('SELECT app_security.actor_role()');} finally {await test.end();}
 let contents=fs.existsSync(envPath)?fs.readFileSync(envPath,'utf8'):'';
 const backup=envPath+'.rbac-backup-'+Date.now();
 if(contents) fs.writeFileSync(backup,contents,{mode:0o600});
 for(const [name,value] of Object.entries({DATABASE_URL:runtimeUrl.toString(),DATABASE_CONTEXT_SECRET:key,PFA_DB_LOGIN:login})) {
  const line=`${name}=${JSON.stringify(value)}`;
  const re=new RegExp(`^${name}=.*$`,'m');
  contents=re.test(contents)?contents.replace(re,()=>line):contents.trimEnd()+'\n'+line+'\n';
 }
 fs.writeFileSync(envPath,contents,{mode:0o600});
 console.log('RBAC setup complete. Restricted login verified; .env.local updated (credentials not printed).');
 console.log('Restart the web app. Run npm run db:rbac:check and npm run db:test:rbac.');
 console.log('Keep DATABASE_URL_DIRECT, DATABASE_CONTEXT_SECRET and all .env files private.');
} catch(e) {
 try {await client.query('ROLLBACK');} catch {}
 console.error('RBAC setup failed:',e.message);process.exitCode=1;
} finally {await client.end();}
