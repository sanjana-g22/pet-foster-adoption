import { NextResponse } from "next/server";
import { setSessionCookie } from "@/lib/auth";
import { anonymousQuery } from "@/lib/db";
import { ApiError, toResponse } from "@/lib/errors";
import type { Role } from "@/lib/roles";
import { loginSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  try {
    const { email, password } = loginSchema.parse(await request.json());
    const { rows } = await anonymousQuery<{ id: number; full_name: string; is_active: boolean; is_approved: boolean; role: Role }>(
      "SELECT * FROM app_security.login($1,$2)", [email,password]
    );
    const user = rows[0];
    if (!user) throw new ApiError(401, "Invalid email or password");
    if (!user.is_active) throw new ApiError(403, "This account has been deactivated");
    await setSessionCookie(user.id,user.role);
    return NextResponse.json({ data: { id:user.id, fullName:user.full_name, role:user.role, isApproved:user.is_approved } });
  } catch (e) { return toResponse(e); }
}
