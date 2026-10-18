import { NextResponse } from "next/server";
import { requireRole } from "@/lib/auth";
import { query } from "@/lib/db";
import { toResponse } from "@/lib/errors";

// Example of a role-protected route: only admins may list users.
// Pattern for EVERY protected route: call requireRole(...) first, then do the work.
export async function GET() {
  try {
    await requireRole("admin");
    const { rows } = await query(
      `SELECT u.id, u.email, u.full_name AS "fullName", r.name AS role,
              u.is_active AS "isActive", u.is_approved AS "isApproved", u.created_at AS "createdAt"
         FROM users u JOIN roles r ON r.id = u.role_id
        ORDER BY u.id`
    );
    return NextResponse.json({ data: rows });
  } catch (e) {
    return toResponse(e);
  }
}
