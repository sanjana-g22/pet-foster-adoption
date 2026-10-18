// Next.js 16 "proxy" (the new name for middleware). Blocks PAGE routes by role.
// API routes are protected separately by requireRole() inside each route handler.
import { NextRequest, NextResponse } from "next/server";
import type { Role } from "@/lib/roles";
import { COOKIE_NAME, verifyToken } from "@/lib/token";

const RULES: { prefix: string; roles: Role[] }[] = [
  { prefix: "/admin", roles: ["admin"] },
  { prefix: "/staff", roles: ["staff", "admin"] },
  { prefix: "/foster", roles: ["foster"] },
  { prefix: "/adopter", roles: ["adopter"] },
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const rule = RULES.find((r) => pathname === r.prefix || pathname.startsWith(r.prefix + "/"));
  if (!rule) return NextResponse.next();

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;

  if (!session) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }
  if (!rule.roles.includes(session.role)) {
    return NextResponse.redirect(new URL("/forbidden", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/staff/:path*", "/foster/:path*", "/adopter/:path*"],
};
