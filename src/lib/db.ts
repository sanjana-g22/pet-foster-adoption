// Single shared PostgreSQL pool + a transaction helper that tells the database WHO is acting.
import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __pgPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set (check .env.local)");
  }
  return new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 20_000,
  });
}

// Reuse the pool across hot reloads in dev so we don't open hundreds of connections.
export function getPool(): Pool {
  if (!globalThis.__pgPool) globalThis.__pgPool = createPool();
  return globalThis.__pgPool;
}

/** Read-only / simple queries. ALWAYS pass values through $1, $2... (never string concatenation). */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, params);
}

/**
 * Run a write workflow in ONE transaction.
 * Sets app.current_user_id so the audit and status-history triggers record who did it.
 * Any thrown error rolls everything back.
 */
export async function withTransaction<T>(
  actorId: number | null,
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    if (actorId !== null) {
      await client.query("SELECT set_config('app.current_user_id', $1, true)", [
        String(actorId),
      ]);
    }
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore rollback failure, surface the original error */
    }
    throw err;
  } finally {
    client.release();
  }
}
