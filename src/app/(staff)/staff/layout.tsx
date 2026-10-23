import Link from "next/link";
import { requirePage } from "@/lib/page-auth";

const LINKS = [
  { href: "/staff", label: "Dashboard", icon: "▦" },
  { href: "/staff/applications", label: "Applications", icon: "♡" },
  { href: "/staff/pets", label: "All pets", icon: "🐾" },
  { href: "/staff/fosters", label: "Fosters", icon: "⌂" },
  { href: "/staff/at-risk", label: "At-risk pets", icon: "!" },
  { href: "/staff/vaccinations", label: "Vaccinations", icon: "✚" },
];

export default async function StaffLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requirePage("staff", "admin");

  return (
    <div className="min-h-[75vh] bg-[#f6f5ef]">
      <div className="page-shell grid gap-6 py-6 lg:grid-cols-[230px_minmax(0,1fr)] lg:py-8">
        <aside className="h-fit rounded-[24px] border border-[#e4e4d9] bg-white p-4 shadow-sm print:hidden lg:sticky lg:top-24">
          <div className="mb-4 px-3 pb-4 pt-2">
            <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#a45e40]">
              Workspace
            </p>

            <h2 className="mt-2 text-xl font-extrabold text-[#24372d]">
              Staff portal
            </h2>

            <p className="mt-1 text-sm text-[#69756c]">
              Care starts here.
            </p>
          </div>

          <nav aria-label="Staff navigation" className="grid gap-1">
            {LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
                  link.href === "/staff"
                    ? "bg-[#e8efe7] text-[#245c45]"
                    : "text-[#526257] hover:bg-[#f6f5ef] hover:text-[#245c45]"
                }`}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#f0eee6] text-sm">
                  {link.icon}
                </span>

                {link.label}
              </Link>
            ))}
          </nav>

          <div className="mt-5 rounded-2xl bg-[#245c45] p-4 text-white">
            <p className="text-sm font-bold">Every detail matters.</p>
            <p className="mt-1 text-xs leading-5 text-[#d7e7d9]">
              Thank you for helping pets find safe and loving homes.
            </p>
          </div>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}