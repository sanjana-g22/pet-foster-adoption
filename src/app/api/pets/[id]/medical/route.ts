import { api, idOf, type IdCtx } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { medicalSchema } from "@/lib/validators/pets";

export const POST = api<IdCtx>(async (req, ctx) => {
  const user = await requireRole("staff", "admin");
  const id = await idOf(ctx);
  const b = medicalSchema.parse(await req.json());
  return withTransaction(user.id, async (c) => {
    const { rows } = await c.query<{ id: number }>(
      `INSERT INTO medical_records (pet_id, record_type, record_date, vet_name, diagnosis, treatment, notes, created_by)
       VALUES ($1, $2, COALESCE($3::date, CURRENT_DATE), $4, $5, $6, $7, $8) RETURNING id`,
      [id, b.recordType, b.recordDate ?? null, b.vetName, b.diagnosis, b.treatment, b.notes, user.id]
    );
    return { id: rows[0].id };
  });
}, 201);
