import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { toResponse } from "@/lib/errors";

export async function GET() {
  try {
    const user = await requireUser();
    return NextResponse.json({ data: user });
  } catch (e) {
    return toResponse(e);
  }
}
