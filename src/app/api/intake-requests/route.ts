import { api } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { intakeSchema } from "@/lib/validators/intake";
export const POST = api(async req => {
 const user = await requireRole("foster");
 const body = intakeSchema.parse(await req.json());
 return withTransaction(user.id, async c => (await c.query("SELECT app_security.submit_intake($1::jsonb) AS id", [JSON.stringify(body)])).rows[0]);
}, 201);
