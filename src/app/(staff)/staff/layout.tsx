import Link from "next/link";
import { requirePage } from "@/lib/page-auth";

const LINKS = [
  ["/staff", "Dashboard"], ["/staff/pets", "All pets"], ["/staff/pets/new", "+ New intake"],
  ["/staff/fosters", "Fosters"], ["/staff/at-risk", "At-Risk board"], ["/staff/vaccinations", "Vaccinations"],
];

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  await requirePage("staff", "admin");
  return (
    <div>
      <nav className="border-b bg-white print:hidden">
        <div className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4 py-2 text-sm">
          {LINKS.map(([href, text]) => <Link key={href} href={href} className="text-teal-800 hover:underline">{text}</Link>)}
        </div>
      </nav>
      {children}
    </div>
  );
}
