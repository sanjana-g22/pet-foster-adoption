import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { ApiError, toResponse } from "@/lib/errors";

export async function GET() {
  try {
    const user = await requireRole("adopter");
    const result = await query(
      `SELECT a.id, a.pet_id, p.name AS pet_name, p.species, a.status, a.message,
              a.submitted_at, a.review_note
       FROM applications a JOIN pets p ON p.id=a.pet_id
       WHERE a.adopter_user_id=$1 ORDER BY a.submitted_at DESC`,
      [user.id]
    );
    return NextResponse.json({ applications: result.rows });
  } catch (error) { return toResponse(error); }
}

export async function POST(request: Request) {
  try {
    const user = await requireRole("adopter");
    const body = await request.json();
    const petId = Number(body.pet_id);
    const message = String(body.message ?? "").trim();
    if (!Number.isInteger(petId) || petId <= 0 || message.length > 4000) {
      throw new ApiError(400, "Provide a valid pet_id and a message under 4000 characters");
    }
    const result = await withTransaction(user.id, async (client) => {
      const pet = await client.query("SELECT id, status FROM pets WHERE id=$1 FOR UPDATE", [petId]);
      if (!pet.rows[0]) throw new ApiError(404, "Pet not found");
      if (!["available", "in_foster"].includes(pet.rows[0].status)) {
        throw new ApiError(409, "This pet is not currently accepting applications");
      }
      return client.query(
        `INSERT INTO applications (pet_id, adopter_user_id, message)
         VALUES ($1,$2,$3)
         ON CONFLICT (pet_id, adopter_user_id) DO UPDATE SET message=EXCLUDED.message
         WHERE applications.status IN ('rejected','withdrawn')
         RETURNING id, pet_id, status, submitted_at`,
        [petId, user.id, message]
      );
    });
    if (!result.rows[0]) throw new ApiError(409, "You already have an application for this pet");
    return NextResponse.json({ application: result.rows[0] }, { status: 201 });
  } catch (error) { return toResponse(error); }
}
