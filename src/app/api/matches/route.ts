import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { ApiError, toResponse } from "@/lib/errors";

// Accepts a precomputed 384-D embedding. The UI/model adapter should generate it
// using Xenova/all-MiniLM-L6-v2 and send { embedding: number[], species?: string }.
export async function POST(request: Request) {
  try {
    await requireRole("adopter");
    const body = await request.json();
    const embedding = body.embedding;
    if (!Array.isArray(embedding) || embedding.length !== 384 ||
        embedding.some((n: unknown) => typeof n !== "number" || !Number.isFinite(n))) {
      throw new ApiError(400, "embedding must be an array of 384 finite numbers");
    }
    const species = ["dog","cat","rabbit","other"].includes(body.species) ? body.species : null;
    const vectorLiteral = `[${embedding.join(",")}]`;
    const result = await query(
      `SELECT p.id, p.name, p.species, p.breed, p.age_months, p.size, p.temperament,
              p.description, p.good_with_kids, p.good_with_pets, p.apartment_friendly,
              round((1 - (e.embedding <=> $1::vector))::numeric, 4) AS similarity
       FROM pet_embeddings e JOIN pets p ON p.id=e.pet_id
       WHERE p.status='available' AND ($2::species_type IS NULL OR p.species=$2::species_type)
       ORDER BY e.embedding <=> $1::vector LIMIT 12`,
      [vectorLiteral, species]
    );
    return NextResponse.json({ matches: result.rows });
  } catch (error) { return toResponse(error); }
}
