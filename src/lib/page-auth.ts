// For server-component PAGES: redirect instead of throwing JSON errors.
import { redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./auth";
import type { Role } from "./roles";

export async function requirePage(...allowed: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!allowed.includes(user.role)) redirect("/forbidden");
  return user;
}
