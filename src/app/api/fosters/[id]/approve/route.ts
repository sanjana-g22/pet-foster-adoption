import { api, idOf, type IdCtx } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { approveSchema } from "@/lib/validators/pets";

// STAFF: approve or revoke a foster account
export const POST = api<IdCtx>(async (req, ctx) => {
  const user = await requireRole("staff", "admin");
  const id = await idOf(ctx);
  const b = approveSchema.parse(await req.json());
  return withTransaction(user.id, async (c) => {
    const r = await c.query(
      `UPDATE users SET is_approved = $1
        WHERE id = $2 AND role_id = (SELECT id FROM roles WHERE name = 'foster')`,
      [b.approved, id]
    );
    if (r.rowCount === 0) throw new ApiError(404, "Foster not found");
    return { id, approved: b.approved };
  });
});
