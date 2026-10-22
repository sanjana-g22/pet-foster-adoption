// Shared pet queries: used by both the pages and the API routes.
import { query } from "./db";
import { SIZES, SPECIES, STATUSES, type PetInput } from "./validators/pets";

export interface PetRow {
  id: number; name: string; species: string; breed: string | null; age_months: number; size: string;
  status: string; good_with_kids: boolean; apartment_friendly: boolean; energy_level: number;
  photo_url: string | null; days_in_shelter: number;
}
export interface PetFilters {
  q?: string; species?: string; size?: string; age?: string; kids?: string; status?: string; page?: number; limit?: number;
}

const LIST_COLS = `p.id, p.name, p.species, p.breed, p.age_months, p.size, p.status, p.good_with_kids,
  p.apartment_friendly, p.energy_level, p.photo_url, (CURRENT_DATE - p.intake_date) AS days_in_shelter`;

export const PET_COLS = `p.id, p.name, p.species, p.breed, p.sex, p.age_months, p.size, p.weight_kg, p.microchip_no,
  p.status, p.intake_date, p.intake_source, p.temperament, p.description, p.good_with_kids, p.good_with_pets,
  p.apartment_friendly, p.house_trained, p.energy_level, p.special_needs, p.photo_url`;

const has = (list: readonly string[], v?: string) => !!v && list.includes(v);

/** Filtered, full-text searched, paginated pet list. status: 'all' | <status>; default 'available'. */
export async function searchPets(f: PetFilters) {
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, v: unknown) => { params.push(v); where.push(sql.replace("?", `$${params.length}`)); };

  const status = f.status === "all" || has(STATUSES, f.status) ? f.status! : "available";
  if (status !== "all") add("p.status = ?::pet_status", status);
  if (has(SPECIES, f.species)) add("p.species = ?::species_type", f.species);
  if (has(SIZES, f.size)) add("p.size = ?::size_type", f.size);
  if (f.age === "baby") where.push("p.age_months < 12");
  if (f.age === "adult") where.push("p.age_months BETWEEN 12 AND 95");
  if (f.age === "senior") where.push("p.age_months >= 96");
  if (f.kids === "1") where.push("p.good_with_kids");

  let rankOrder = "";
  const words = (f.q ?? "").toLowerCase().match(/[a-z0-9]+/g)?.slice(0, 8);
  if (words?.length) {
    params.push(words.join(" | "));
    where.push(`p.search_vector @@ to_tsquery('english', $${params.length})`);
    rankOrder = `ts_rank(p.search_vector, to_tsquery('english', $${params.length})) DESC, `;
  }

  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const limit = Math.min(Math.max(Math.floor(f.limit ?? 12), 1), 50);
  const page = Math.max(Math.floor(f.page ?? 1) || 1, 1);

  const total = (await query<{ n: number }>(`SELECT count(*) AS n FROM pets p ${w}`, params)).rows[0].n;
  const rows = (await query<PetRow>(
    `SELECT ${LIST_COLS} FROM pets p ${w}
      ORDER BY ${rankOrder}p.intake_date DESC, p.id LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
    params
  )).rows;
  return { rows, total, page, limit };
}

/** Values in the same order as the INSERT / UPDATE column lists in the pet routes. */
export function petValues(b: PetInput): unknown[] {
  return [b.name, b.species, b.breed, b.sex, b.ageMonths, b.size, b.weightKg, b.microchipNo, b.intakeSource,
    b.temperament, b.description, b.goodWithKids, b.goodWithPets, b.apartmentFriendly, b.houseTrained,
    b.energyLevel, b.specialNeeds, b.photoUrl];
}

export interface FosterSuggestion {
  id: number; full_name: string; city: string | null; experience_level: string; has_yard: boolean;
  free_slots: number; successes: number; pref_match: boolean; score: number; reasons: string[];
}

/** Foster recommender: top 3 approved homes with a free slot, scored by fit (max 100). */
export async function recommendFosters(petId: number): Promise<FosterSuggestion[]> {
  const { rows } = await query<Omit<FosterSuggestion, "reasons">>(
    `WITH pet AS (
       SELECT species, (COALESCE(trim(special_needs), '') <> '' OR energy_level >= 4) AS needs_exp
         FROM pets WHERE id = $1)
     SELECT fp.user_id AS id, u.full_name, fp.address_city AS city, fp.experience_level, fp.has_yard,
            fp.max_capacity - COALESCE(a.active, 0) AS free_slots,
            COALESCE(a.adopted, 0) AS successes,
            (cardinality(fp.species_preference) = 0 OR pet.species = ANY(fp.species_preference)) AS pref_match,
            (CASE WHEN cardinality(fp.species_preference) = 0 OR pet.species = ANY(fp.species_preference) THEN 40 ELSE 0 END)
          + (CASE WHEN pet.needs_exp THEN (CASE fp.experience_level WHEN 'experienced' THEN 20 WHEN 'some' THEN 10 ELSE 0 END) ELSE 20 END)
          + LEAST(20, (fp.max_capacity - COALESCE(a.active, 0)) * 10)
          + LEAST(20, COALESCE(a.adopted, 0) * 10) AS score
       FROM pet
       CROSS JOIN foster_profiles fp
       JOIN users u ON u.id = fp.user_id AND u.is_active AND u.is_approved
       LEFT JOIN (SELECT foster_user_id,
                         count(*) FILTER (WHERE status = 'active') AS active,
                         count(*) FILTER (WHERE end_reason = 'adopted') AS adopted
                    FROM foster_placements GROUP BY foster_user_id) a ON a.foster_user_id = fp.user_id
      WHERE fp.max_capacity - COALESCE(a.active, 0) > 0
      ORDER BY score DESC, free_slots DESC, u.full_name LIMIT 3`,
    [petId]
  );
  return rows.map((r) => ({
    ...r,
    reasons: [
      r.pref_match ? "Takes this species" : "Different species preference",
      `${r.free_slots} free slot${r.free_slots === 1 ? "" : "s"}`,
      `${r.experience_level.replace("_", " ")} fosterer`,
      ...(r.successes > 0 ? [`${r.successes} past adoption${r.successes === 1 ? "" : "s"}`] : []),
    ],
  }));
}