import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { ApiError, toResponse } from "@/lib/errors";

export async function GET() {
  try {
    const user = await requireRole("adopter", "staff", "admin");
    const result = await query(
      `SELECT f.id, f.due_date, f.day_number, f.status, f.adopter_notes,
              p.name AS pet_name, a.adopter_user_id
       FROM followups f JOIN adoptions a ON a.id=f.adoption_id
       JOIN pets p ON p.id=a.pet_id
       WHERE ($1::text IN ('staff','admin') OR a.adopter_user_id=$2)
       ORDER BY f.due_date`,
      [user.role, user.id]
    );
    return NextResponse.json({ followups: result.rows });
  } catch (error) { return toResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const user = await requireRole("adopter");
    const body = await request.json();
    const id = Number(body.followup_id);
    const notes = String(body.adopter_notes ?? "").trim().slice(0, 4000);
    if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "Invalid followup_id");
    const result = await withTransaction(user.id, async (client) => client.query(
      `UPDATE followups f SET status='completed', adopter_notes=$1, completed_at=now()
       FROM adoptions a WHERE f.adoption_id=a.id AND a.adopter_user_id=$2
         AND f.id=$3 AND f.status IN ('scheduled','overdue')
       RETURNING f.id, f.status, f.completed_at`,
      [notes, user.id, id]
    ));
    if (!result.rows[0]) throw new ApiError(404, "Follow-up not found or already completed");
    return NextResponse.json({ followup: result.rows[0] });
  } catch (error) { return toResponse(error); }
}
