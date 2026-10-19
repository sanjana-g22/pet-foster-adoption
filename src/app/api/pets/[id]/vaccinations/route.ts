import { api, idOf, type IdCtx } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { vaccinationSchema } from "@/lib/validators/pets";

export const POST = api<IdCtx>(async (req, ctx) => {
  const user = await requireRole("staff", "admin");
  const id = await idOf(ctx);
  const b = vaccinationSchema.parse(await req.json());
  return withTransaction(user.id, async (c) => {
    // expiry defaults to one year after the vaccination date
    const { rows } = await c.query<{ id: number }>(
      `INSERT INTO vaccinations (pet_id, vaccine_name, vaccinated_on, expires_on, administered_by, created_by)
       VALUES ($1, $2, $3::date, COALESCE($4::date, $3::date + 365), $5, $6) RETURNING id`,
      [id, b.vaccineName, b.vaccinatedOn, b.expiresOn ?? null, b.administeredBy, user.id]
    );
    return { id: rows[0].id };
  });
}, 201);
