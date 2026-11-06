// All web queries run as a restricted PostgreSQL role in a transaction.
import "server-only";
import { createHmac } from "node:crypto";
import { cookies } from "next/headers";
import { Pool, types, type PoolClient, type QueryResult, type QueryResultRow } from "pg";
import { COOKIE_NAME, verifyToken } from "./token";

types.setTypeParser(1082, (v) => v);
types.setTypeParser(1700, (v) => parseFloat(v));
types.setTypeParser(20, (v) => parseInt(v, 10));
declare global { var __pgPool: Pool | undefined; }
const DB_ROLES = { guest: 'pfa_guest', adopter: 'pfa_adopter', foster: 'pfa_foster', staff: 'pfa_staff', admin: 'pfa_admin' } as const;
function getPool(): Pool {
  if (!globalThis.__pgPool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL missing; run npm run db:rbac:setup");
    globalThis.__pgPool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 20_000 });
  }
  return globalThis.__pgPool;
}

async function transaction<T>(actorId: number | null | undefined, fn: (client: PoolClient) => Promise<T>, anonymous = false): Promise<T> {
  const token = anonymous ? undefined : (await cookies()).get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;
  const userId = session?.userId ?? null;
  if (actorId != null && actorId !== userId) throw new Error("Transaction actor does not match the authenticated session");
  const client = await getPool().connect();
  let broken = false;
  try {
    await client.query("BEGIN");
    const check = await client.query<{ safe: boolean; xid: string }>(`
      SELECT NOT r.rolsuper AND NOT r.rolbypassrls AND NOT r.rolcreatedb AND NOT r.rolcreaterole
        AND NOT r.rolinherit AND NOT EXISTS (
          SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
          WHERE n.nspname IN ('public','app_security') AND pg_has_role(session_user,c.relowner,'MEMBER')
        ) AS safe, txid_current()::text AS xid
      FROM pg_roles r WHERE r.rolname=session_user`);
    if (!check.rows[0]?.safe) throw new Error("Unsafe web database login. Stop the app and run npm run db:rbac:setup; never use the database owner as DATABASE_URL.");
    let signature = '';
    if (userId !== null) {
      const secret = process.env.DATABASE_CONTEXT_SECRET;
      if (!secret || secret.length < 64) throw new Error("DATABASE_CONTEXT_SECRET missing; run npm run db:rbac:setup");
      signature = createHmac('sha256', secret).update(`${userId}:${check.rows[0].xid}`).digest('hex');
    }
    await client.query("SELECT set_config('app.current_user_id',$1,true), set_config('app.context_signature',$2,true)", [userId === null ? '' : String(userId), signature]);
    // Read the CURRENT role from PostgreSQL; a stale role claim in a JWT is ignored.
    const identity = await client.query<{ role: keyof typeof DB_ROLES; id: number | null }>("SELECT app_security.actor_role() AS role, app_security.actor_id() AS id");
    const identityRow = identity.rows[0];
    if (userId !== null && identityRow.id === null) {
      // Inactive users receive no protected data, even with an unexpired cookie.
      if (actorId != null) throw new Error("Inactive or invalid database identity");
    }
    const dbRole = DB_ROLES[identityRow.role];
    if (!dbRole) throw new Error("Unsupported database role");
    await client.query(`SET LOCAL ROLE ${dbRole}`); // hard-coded allowlist only
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    try { await client.query("ROLLBACK"); } catch { broken = true; }
    throw error;
  } finally {
    client.release(broken);
  }
}
export async function query<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  return transaction(undefined, (client) => client.query<T>(text, params));
}
export async function withTransaction<T>(actorId: number | null, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  return transaction(actorId, fn);
}
// Only login and self-registration need this explicitly anonymous entry point.
export async function anonymousQuery<T extends QueryResultRow = QueryResultRow>(text: string, params: unknown[] = []): Promise<QueryResult<T>> {
  return transaction(null, (client) => client.query<T>(text, params), true);
}
