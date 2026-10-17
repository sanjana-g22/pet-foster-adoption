import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env.local") });

const url = process.env.DATABASE_URL_DIRECT;
if (!url) {
  console.error("DATABASE_URL_DIRECT is missing in .env.local");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url });
const dir = path.join(__dirname, "migrations");

async function main() {
  await client.connect();
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename   text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )`);
  const { rows } = await client.query("SELECT filename FROM schema_migrations");
  const done = new Set(rows.map((r) => r.filename));
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();

  for (const f of files) {
    if (done.has(f)) continue;
    const sql = fs.readFileSync(path.join(dir, f), "utf8");
    console.log("Running", f);
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations(filename) VALUES ($1)", [f]);
      await client.query("COMMIT");
    } catch (e) {
      await client.query("ROLLBACK");
      console.error("FAILED:", f, "-", e.message);
      process.exitCode = 1;
      break;
    }
  }
  await client.end();
  console.log("Done");
}
main();