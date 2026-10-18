import Link from "next/link";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/roles";
import LogoutButton from "./LogoutButton";

export default async function Navbar() {
  let user: CurrentUser | null = null;
  try {
    user = await getCurrentUser();
  } catch {
    user = null; // never let a DB hiccup break every page
  }

  return (
    <header className="bg-teal-700 text-white">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-bold">
            🐾 Pawfect Match
          </Link>
          <Link href="/" className="text-sm hover:underline">
            Browse pets
          </Link>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {user ? (
            <>
              <Link href={ROLE_HOME[user.role]} className="hover:underline">
                {user.fullName} <span className="opacity-75">({user.role})</span>
              </Link>
              <LogoutButton />
            </>
          ) : (
            <>
              <Link href="/login" className="hover:underline">
                Log in
              </Link>
              <Link
                href="/register"
                className="rounded-md bg-white px-3 py-1 font-medium text-teal-800 hover:bg-teal-50"
              >
                Register
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
