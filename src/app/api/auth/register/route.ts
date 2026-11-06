import { NextResponse } from "next/server";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { anonymousQuery } from "@/lib/db";
import { toResponse } from "@/lib/errors";
import { registerSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  try {
    const body = registerSchema.parse(await request.json());
    const isFoster = body.role === "foster";
    const passwordHash = await hashPassword(body.password);

    const { rows } = await anonymousQuery<{ id: number }>(
      "SELECT app_security.register($1,$2,$3,$4,$5) AS id",
      [body.email, passwordHash, body.fullName, body.phone || null, body.role]
    );
    const userId = rows[0].id;

    await setSessionCookie(userId, body.role);
    return NextResponse.json(
      { data: { id: userId, role: body.role, isApproved: !isFoster } },
      { status: 201 }
    );
  } catch (e) {
    return toResponse(e);
  }
}
