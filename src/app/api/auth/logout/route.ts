import { NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";
import { toResponse } from "@/lib/errors";

export async function POST() {
  try {
    await clearSessionCookie();
    return NextResponse.json({ data: { ok: true } });
  } catch (e) {
    return toResponse(e);
  }
}
