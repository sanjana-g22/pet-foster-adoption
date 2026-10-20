import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { query, withTransaction } from "@/lib/db";
import { ApiError, toResponse } from "@/lib/errors";

export async function GET() {
  try {
    await requireRole("staff", "admin");
    const result = await query(
      `SELECT a.id, a.status, a.message, a.submitted_at, a.review_note,
              p.id AS pet_id, p.name AS pet_name, p.species,
              u.id AS adopter_id, u.full_name AS adopter_name, u.email AS adopter_email
       FROM applications a JOIN pets p ON p.id=a.pet_id
       JOIN users u ON u.id=a.adopter_user_id
       ORDER BY CASE WHEN a.status IN ('submitted','under_review') THEN 0 ELSE 1 END,
                a.submitted_at ASC`
    );
    return NextResponse.json({ applications: result.rows });
  } catch (error) { return toResponse(error); }
}

export async function PATCH(request: Request) {
  try {
    const staff = await requireRole("staff", "admin");
    const body = await request.json();
    const id = Number(body.application_id);
    const action = body.action;
    const note = String(body.review_note ?? "").trim().slice(0, 2000);
    if (!Number.isInteger(id) || id <= 0 || !["approve","reject","review"].includes(action)) {
      throw new ApiError(400, "Invalid application_id or action");
    }
    const result = await withTransaction(staff.id, async (client) => {
      if (action === "approve") {
        const adoption = await client.query("SELECT approve_adoption($1,$2) AS adoption_id", [id, staff.id]);
        return { adoption_id: adoption.rows[0].adoption_id };
      }
      const status = action === "reject" ? "rejected" : "under_review";
      const updated = await client.query(
        `UPDATE applications SET status=$1::application_status, reviewer_user_id=$2,
          review_note=$3, reviewed_at=CASE WHEN $1='rejected' THEN now() ELSE reviewed_at END,
          updated_at=now()
         WHERE id=$4 AND status IN ('submitted','under_review') RETURNING id,status`,
        [status, staff.id, note || null, id]
      );
      if (!updated.rows[0]) throw new ApiError(409, "Application not found or already processed");
      return updated.rows[0];
    });
    return NextResponse.json({ result });
  } catch (error) { return toResponse(error); }
}
