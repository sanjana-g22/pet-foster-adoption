import Link from "next/link";
import StatusBadge from "@/components/StatusBadge";
import { query } from "@/lib/db";
import { card } from "@/lib/ui";

export default async function StaffDashboard() {
  const byStatus = (await query<{ status: string; n: number }>("SELECT status, count(*) AS n FROM pets GROUP BY status ORDER BY n DESC")).rows;
  const one = async (sql: string) => (await query<{ n: number }>(sql)).rows[0].n;
  const pendingFosters = await one("SELECT count(*) AS n FROM users WHERE is_approved = false AND role_id = (SELECT id FROM roles WHERE name='foster')");
  const urgent = await one("SELECT count(*) AS n FROM v_at_risk_pets WHERE urgency_level IN ('critical','high')");
  const overdue = await one("SELECT count(DISTINCT pet_id) AS n FROM v_overdue_vaccinations");

  const tiles: [string, number, string][] = [
    ["Fosters awaiting approval", pendingFosters, "/staff/fosters"],
    ["High / critical At-Risk pets", urgent, "/staff/at-risk"],
    ["Pets with overdue vaccines", overdue, "/staff/vaccinations"],
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Staff dashboard</h1>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {tiles.map(([t, n, href]) => (
          <Link key={t} href={href} className={`${card} hover:shadow-md`}>
            <p className="text-3xl font-bold text-teal-700">{n}</p><p className="text-sm text-gray-600">{t}</p>
          </Link>
        ))}
      </div>
      <h2 className="mb-2 mt-8 font-semibold">Pets by lifecycle stage</h2>
      <div className="flex flex-wrap gap-3">
        {byStatus.map((s) => (
          <Link key={s.status} href={`/staff/pets?status=${s.status}`} className={`${card} flex items-center gap-2 hover:shadow-md`}>
            <StatusBadge status={s.status} /> <b>{s.n}</b>
          </Link>
        ))}
      </div>
    </main>
  );
}
