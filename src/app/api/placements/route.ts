import { api } from "@/lib/api";
import { requireRole } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { placeSchema } from "@/lib/validators/pets";

// STAFF: place an available pet with a foster (row locks + capacity rule live in the database)
export const POST = api(async (req) => {
  const user = await requireRole("staff", "admin");
  const b = placeSchema.parse(await req.json());
  return withTransaction(user.id, async (c) => {
    const { rows } = await c.query<{ id: number }>(
      "SELECT sp_place_in_foster($1, $2, $3::date, $4) AS id",
      [b.petId, b.fosterId, b.expectedEnd ?? null, user.id]
    );
    return { id: rows[0].id };
  });
}, 201);
