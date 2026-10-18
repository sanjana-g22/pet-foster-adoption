import { NextResponse } from "next/server";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { withTransaction } from "@/lib/db";
import { toResponse } from "@/lib/errors";
import { registerSchema } from "@/lib/validators/auth";

export async function POST(request: Request) {
  try {
    const body = registerSchema.parse(await request.json());
    const isFoster = body.role === "foster";
    const passwordHash = await hashPassword(body.password);

    const userId = await withTransaction(null, async (client) => {
      const { rows } = await client.query<{ id: number }>(
        `INSERT INTO users (email, password_hash, full_name, phone, role_id, is_approved)
         VALUES ($1, $2, $3, $4, (SELECT id FROM roles WHERE name = $5), $6)
         RETURNING id`,
        [body.email, passwordHash, body.fullName, body.phone || null, body.role, !isFoster]
      );
      const id = rows[0].id;
      // Every foster gets a profile row (capacity 1 by default); staff approve the account later.
      if (isFoster) {
        await client.query("INSERT INTO foster_profiles (user_id) VALUES ($1)", [id]);
      }
      return id;
    });

    await setSessionCookie(userId, body.role);
    return NextResponse.json(
      { data: { id: userId, role: body.role, isApproved: !isFoster } },
      { status: 201 }
    );
  } catch (e) {
    return toResponse(e);
  }
}
