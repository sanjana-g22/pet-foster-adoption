import { api, idOf, type IdCtx } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { ApiError } from "@/lib/errors";
import { petValues } from "@/lib/pets";
import { petSchema } from "@/lib/validators/pets";

// STAFF: edit pet details (status is NOT editable here; it only moves through the workflow functions)
export const PUT = api<IdCtx>(async (req, ctx) => {
  const user = await requireRole("staff", "admin");
  const id = await idOf(ctx);
  const body = petSchema.parse(await req.json());
  return withTransaction(user.id, async (c) => {
    const r = await c.query(
      `UPDATE pets SET name=$1, species=$2, breed=$3, sex=$4, age_months=$5, size=$6, weight_kg=$7,
              microchip_no=$8, intake_source=$9, temperament=$10, description=$11, good_with_kids=$12,
              good_with_pets=$13, apartment_friendly=$14, house_trained=$15, energy_level=$16,
              special_needs=$17, photo_url=$18
        WHERE id=$19`,
      [...petValues(body), id]
    );
    if (r.rowCount === 0) throw new ApiError(404, "Pet not found");
    return { id };
  });
});
