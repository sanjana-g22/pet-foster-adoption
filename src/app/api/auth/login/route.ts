import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { setSessionCookie, verifyPassword } from "@/lib/auth";
import { query } from "@/lib/db";
import { ApiError, toResponse } from "@/lib/errors";
import type { Role } from "@/lib/roles";
import { loginSchema } from "@/lib/validators/auth";

// Used so a wrong email takes the same time as a wrong password (no user enumeration)
const DUMMY_HASH = bcrypt.hashSync("not-a-real-password", 10);

export async function POST(request: Request) {
  try {
    const { email, password } = loginSchema.parse(await request.json());

    const { rows } = await query<{
      id: number;
      full_name: string;
      password_hash: string;
      is_active: boolean;
      is_approved: boolean;
      role: Role;
    }>(
      `SELECT u.id, u.full_name, u.password_hash, u.is_active, u.is_approved, r.name AS role
         FROM users u JOIN roles r ON r.id = u.role_id
        WHERE u.email = $1`,
      [email]
    );
    const user = rows[0];

    const ok = await verifyPassword(password, user ? user.password_hash : DUMMY_HASH);
    if (!user || !ok) throw new ApiError(401, "Invalid email or password");
    if (!user.is_active) throw new ApiError(403, "This account has been deactivated");

    await setSessionCookie(user.id, user.role);
    return NextResponse.json({
      data: { id: user.id, fullName: user.full_name, role: user.role, isApproved: user.is_approved },
    });
  } catch (e) {
    return toResponse(e);
  }
}
