// Server-only auth helpers: password hashing, session cookie, current user, role checks.
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { query } from "./db";
import { ApiError } from "./errors";
import type { Role } from "./roles";
import { COOKIE_NAME, SESSION_HOURS, signToken, verifyToken } from "./token";

export interface CurrentUser {
  id: number;
  email: string;
  fullName: string;
  role: Role;
  isApproved: boolean;
}

const BCRYPT_COST = 10;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_COST);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function setSessionCookie(userId: number, role: Role): Promise<void> {
  const token = await signToken(userId, role);
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://"),
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function clearSessionCookie(): Promise<void> {
  const jar = await cookies();
  jar.delete(COOKIE_NAME);
}

/** Returns the logged-in user, or null. Re-checks the database so deactivated users are locked out. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await verifyToken(token);
  if (!session) return null;

  const { rows } = await query<{
    id: number;
    email: string;
    full_name: string;
    role: Role;
    is_active: boolean;
    is_approved: boolean;
  }>(
    `SELECT u.id, u.email, u.full_name, r.name AS role, u.is_active, u.is_approved
       FROM users u JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1`,
    [session.userId]
  );
  const u = rows[0];
  if (!u || !u.is_active) return null;

  return { id: u.id, email: u.email, fullName: u.full_name, role: u.role, isApproved: u.is_approved };
}

/** For API routes: 401 if not logged in. */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw new ApiError(401, "You must be logged in");
  return user;
}

/** For API routes: 401 if not logged in, 403 if the role is not allowed. Call this in EVERY protected route. */
export async function requireRole(...allowed: Role[]): Promise<CurrentUser> {
  const user = await requireUser();
  if (!allowed.includes(user.role)) {
    throw new ApiError(403, "You do not have permission to do this");
  }
  return user;
}
