import { api, idOf, type IdCtx } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { returnSchema } from "@/lib/validators/pets";

export const POST = api<IdCtx>(async (req, ctx) => {
  const user = await requireRole("staff", "admin");
  const id = await idOf(ctx);
  const b = returnSchema.parse(await req.json());
  await withTransaction(user.id, (c) => c.query("SELECT sp_process_return($1, $2, $3)", [id, b.reason, user.id]));
  return { id, status: "returned" };
});
