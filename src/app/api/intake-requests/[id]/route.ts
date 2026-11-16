import { api, idOf, type IdCtx } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { intakeSchema, intakeReviewSchema } from "@/lib/validators/intake";
export const PUT = api<IdCtx>(async (req,ctx) => {
 const user = await requireRole("foster"); const id = await idOf(ctx);
 const body = intakeSchema.parse(await req.json());
 return withTransaction(user.id, async c => (await c.query("SELECT app_security.submit_intake($1::jsonb,$2) AS id", [JSON.stringify(body),id])).rows[0]);
});
export const PATCH = api<IdCtx>(async (req,ctx) => {
 const user = await requireRole("staff","admin"); const id = await idOf(ctx);
 const body = intakeReviewSchema.parse(await req.json());
 return withTransaction(user.id, async c => (await c.query("SELECT app_security.review_intake($1,$2,$3) AS pet_id", [id,body.decision,body.note])).rows[0]);
});
