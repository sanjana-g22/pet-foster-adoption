import { api, idOf, type IdCtx } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { statusSchema } from "@/lib/validators/pets";

// STAFF: manual status change. The database trigger decides if the move is legal (409 if not).
export const POST = api<IdCtx>(async (req, ctx) => {
  const user = await requireRole("staff", "admin");
  const id = await idOf(ctx);
  const b = statusSchema.parse(await req.json());
  await withTransaction(user.id, (c) =>
    c.query("SELECT sp_change_pet_status($1, $2::pet_status, $3, $4)", [id, b.to, b.note, user.id])
  );
  return { id, status: b.to };
});
