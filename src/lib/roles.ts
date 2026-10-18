// Client-safe role definitions (no server imports here)
export const ROLES = ["admin", "staff", "foster", "adopter"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_HOME: Record<Role, string> = {
  admin: "/admin",
  staff: "/staff",
  foster: "/foster",
  adopter: "/adopter",
};

// Only these two roles may self-register. Staff/admin are created by an admin or the seed script.
export const SELF_REGISTER_ROLES = ["adopter", "foster"] as const;
