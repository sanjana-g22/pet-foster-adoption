import { api, idOf, type IdCtx } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { endSchema } from "@/lib/validators/pets";

export const POST = api<IdCtx>(async (req, ctx) => {
  const user = await requireRole("staff", "admin");
  const id = await idOf(ctx);
  const b = endSchema.parse(await req.json());
  await withTransaction(user.id, (c) =>
    c.query("SELECT sp_end_placement($1, $2::placement_end_reason, $3)", [id, b.reason, user.id])
  );
  return { id, status: "completed" };
});
