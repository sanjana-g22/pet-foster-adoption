import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import pg from 'pg';import dotenv from 'dotenv';
const dir=path.dirname(fileURLToPath(import.meta.url));dotenv.config({path:path.resolve(dir,'../../.env.local')});
const c=new pg.Client({connectionString:process.env.DATABASE_URL_DIRECT});
try {
 if(!process.env.DATABASE_URL_DIRECT) throw new Error('DATABASE_URL_DIRECT missing');
 await c.connect();const results=await c.query(fs.readFileSync(path.join(dir,'01_lifecycle_tests.sql'),'utf8'));
 const rows=(Array.isArray(results)?results:[results]).flatMap(r=>r.rows||[]).filter(r=>'test' in r && 'result' in r);
 console.table(rows);if(!rows.length||rows.some(r=>r.result!=='PASS')) throw new Error('Lifecycle checks failed');
 console.log(`${rows.length} lifecycle checks passed; all changes rolled back.`);
} catch(e){console.error(e.message);process.exitCode=1;try{await c.query('ROLLBACK');}catch{}}finally{await c.end();}
