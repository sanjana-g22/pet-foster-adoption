// Seeds the demo accounts (admin, staff, 2 fosters, 2 adopters). Safe to re-run.
// Usage: npm run db:seed:accounts
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import pg from "pg";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", "..", ".env.local") });

const url = process.env.DATABASE_URL_DIRECT;
if (!url) {
  console.error("DATABASE_URL_DIRECT is missing in .env.local");
  process.exit(1);
}

const DEMO_PASSWORD = "Demo@12345";

const accounts = [
  { email: "admin@demo.com", name: "Asha Admin", role: "admin" },
  { email: "staff@demo.com", name: "Sam Staff", role: "staff" },
  {
    email: "foster1@demo.com", name: "Fiona Foster", role: "foster",
    profile: { cap: 3, prefs: ["dog", "cat"], exp: "experienced", yard: true, city: "Indiranagar" },
  },
  {
    email: "foster2@demo.com", name: "Farhan Foster", role: "foster",
    profile: { cap: 2, prefs: ["cat", "rabbit"], exp: "some", yard: false, city: "Jayanagar" },
  },
  { email: "adopter1@demo.com", name: "Anika Adopter", role: "adopter" },
  { email: "adopter2@demo.com", name: "Arjun Adopter", role: "adopter" },
];

const client = new pg.Client({ connectionString: url });

async function main() {
  await client.connect();
  const hash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await client.query("BEGIN");
  try {
    for (const a of accounts) {
      const { rows } = await client.query(
        `INSERT INTO users (email, password_hash, full_name, role_id, is_active, is_approved)
         VALUES ($1, $2, $3, (SELECT id FROM roles WHERE name = $4), true, true)
         ON CONFLICT (email) DO UPDATE
           SET password_hash = EXCLUDED.password_hash,
               full_name = EXCLUDED.full_name,
               role_id = EXCLUDED.role_id,
               is_active = true, is_approved = true
         RETURNING id`,
        [a.email, hash, a.name, a.role]
      );
      if (a.profile) {
        await client.query(
          `INSERT INTO foster_profiles (user_id, max_capacity, species_preference, experience_level, has_yard, address_city)
           VALUES ($1, $2, $3::species_type[], $4::experience_level, $5, $6)
           ON CONFLICT (user_id) DO UPDATE
             SET max_capacity = EXCLUDED.max_capacity,
                 species_preference = EXCLUDED.species_preference,
                 experience_level = EXCLUDED.experience_level,
                 has_yard = EXCLUDED.has_yard,
                 address_city = EXCLUDED.address_city`,
          [rows[0].id, a.profile.cap, a.profile.prefs, a.profile.exp, a.profile.yard, a.profile.city]
        );
      }
      console.log(`  ${a.role.padEnd(7)} ${a.email}`);
    }
    await client.query("COMMIT");
    console.log(`\nDone. Password for every demo account: ${DEMO_PASSWORD}`);
  } catch (e) {
    await client.query("ROLLBACK");
    console.error("FAILED:", e.message);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}
main();
