import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { toResponse } from "@/lib/errors";

// Quick check that the app can reach the database and that pgvector is enabled
export async function GET() {
  try {
    const { rows } = await query<{ now: string; has_vector: boolean }>(
      "SELECT now()::text AS now, EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'vector') AS has_vector"
    );
    return NextResponse.json({ data: { ok: true, time: rows[0].now, pgvector: rows[0].has_vector } });
  } catch (e) {
    return toResponse(e);
  }
}
