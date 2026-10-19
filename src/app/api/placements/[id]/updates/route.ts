import { api, idOf, type IdCtx } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { fosterUpdateSchema } from "@/lib/validators/pets";

// FOSTER (own active placement) or staff/admin: log a daily update
export const POST = api<IdCtx>(async (req, ctx) => {
  const user = await requireRole("foster", "staff", "admin");
  if (user.role === "foster" && !user.isApproved) throw new ApiError(403, "Your foster account is awaiting approval");
  const id = await idOf(ctx);
  const b = fosterUpdateSchema.parse(await req.json());

  const { rows } = await query<{ foster_user_id: number; status: string }>(
    "SELECT foster_user_id, status FROM foster_placements WHERE id = $1", [id]);
  const pl = rows[0];
  if (!pl) throw new ApiError(404, "Placement not found");
  if (user.role === "foster" && pl.foster_user_id !== user.id) throw new ApiError(403, "This is not your placement");
  if (pl.status !== "active") throw new ApiError(409, "This placement has ended");

  return withTransaction(user.id, async (c) => {
    const r = await c.query<{ id: number }>(
      `INSERT INTO foster_updates (placement_id, update_date, weight_kg, behaviour_note, health_note, created_by)
       VALUES ($1, COALESCE($2::date, CURRENT_DATE), $3, $4, $5, $6) RETURNING id`,
      [id, b.updateDate ?? null, b.weightKg ?? null, b.behaviourNote, b.healthNote, user.id]
    );
    return { id: r.rows[0].id };
  });
}, 201);
