// JWT helpers. Edge-safe: no database or next/headers imports (the proxy uses this file too).
import { SignJWT, jwtVerify } from "jose";
import { ROLES, type Role } from "./roles";

export const COOKIE_NAME = "pfa_session";
export const SESSION_HOURS = 8;

function secretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("JWT_SECRET is missing or shorter than 32 characters (check .env.local)");
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(userId: number, role: Role): Promise<string> {
  return new SignJWT({ role })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(String(userId))
    .setIssuedAt()
    .setExpirationTime(`${SESSION_HOURS}h`)
    .sign(secretKey());
}

export async function verifyToken(
  token: string
): Promise<{ userId: number; role: Role } | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey(), { algorithms: ["HS256"] });
    const role = payload.role;
    const sub = payload.sub;
    if (!sub || typeof role !== "string" || !(ROLES as readonly string[]).includes(role)) {
      return null;
    }
    const userId = Number(sub);
    if (!Number.isInteger(userId)) return null;
    return { userId, role: role as Role };
  } catch {
    return null;
  }
}
