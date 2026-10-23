import Link from "next/link";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { ROLE_HOME } from "@/lib/roles";
import LogoutButton from "./LogoutButton";

export default async function Navbar() {
  let user: CurrentUser | null = null;

  try {
    user = await getCurrentUser();
  } catch {
    user = null;
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[#e4e4d9] bg-[#faf8f2]/95 text-[#24372d] backdrop-blur-md print:hidden">
      <nav
        aria-label="Main navigation"
        className="page-shell flex min-h-[76px] flex-wrap items-center justify-between gap-4 py-3"
      >
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#245c45] text-xl text-white">
              🐾
            </span>

            <span>
              <span className="block text-lg font-extrabold tracking-tight text-[#245c45]">
                Pawfect Match
              </span>
              <span className="hidden text-[11px] text-[#69756c] sm:block">
                Find your forever friend
              </span>
            </span>
          </Link>

          <Link
            href="/pets"
            className="hidden rounded-full px-3 py-2 text-sm font-semibold text-[#4c5d50] hover:bg-[#e8efe7] hover:text-[#245c45] sm:inline-flex"
          >
            Find a pet
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-sm">
          <Link
            href="/pets"
            className="rounded-full px-3 py-2 font-semibold text-[#4c5d50] hover:bg-[#e8efe7] sm:hidden"
          >
            Pets
          </Link>

          {user ? (
            <>
              <Link
                href={ROLE_HOME[user.role]}
                className="max-w-48 truncate rounded-full px-3 py-2 font-semibold text-[#245c45] hover:bg-[#e8efe7]"
              >
                {user.fullName}
                <span className="ml-1 hidden text-xs font-normal capitalize text-[#69756c] md:inline">
                  ({user.role})
                </span>
              </Link>

              <LogoutButton />
            </>
          ) : (
            <>
              <Link
                href="/login"
                className="rounded-full px-4 py-2 font-semibold text-[#245c45] hover:bg-[#e8efe7]"
              >
                Log in
              </Link>

              <Link
                href="/register"
                className="rounded-full bg-[#245c45] px-5 py-2.5 font-bold text-white shadow-sm hover:bg-[#194733]"
              >
                Get started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}