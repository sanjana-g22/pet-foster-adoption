import { api } from "@/lib/api";
import { getCurrentUser, requireRole } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { petValues, searchPets } from "@/lib/pets";
import { petSchema } from "@/lib/validators/pets";

// PUBLIC: browse / search. Only staff and admin may ask for non-available pets.
export const GET = api(async (req) => {
  const user = await getCurrentUser().catch(() => null);
  const staff = user?.role === "staff" || user?.role === "admin";
  const sp = new URL(req.url).searchParams;
  return searchPets({
    q: sp.get("q") ?? undefined,
    species: sp.get("species") ?? undefined,
    size: sp.get("size") ?? undefined,
    age: sp.get("age") ?? undefined,
    kids: sp.get("kids") ?? undefined,
    status: staff ? sp.get("status") ?? undefined : undefined,
    page: Number(sp.get("page") ?? 1),
    limit: Number(sp.get("limit") ?? 12),
  });
});

// STAFF: intake a new pet (always starts in 'intake')
export const POST = api(async (req) => {
  const user = await requireRole("staff", "admin");
  const body = petSchema.parse(await req.json());
  return withTransaction(user.id, async (c) => {
    const { rows } = await c.query<{ id: number }>(
      `INSERT INTO pets (name, species, breed, sex, age_months, size, weight_kg, microchip_no, intake_source,
                         temperament, description, good_with_kids, good_with_pets, apartment_friendly,
                         house_trained, energy_level, special_needs, photo_url)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18) RETURNING id`,
      petValues(body)
    );
    return { id: rows[0].id };
  });
}, 201);
