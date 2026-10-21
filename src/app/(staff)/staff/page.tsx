
import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { query } from "@/lib/db";

export default async function StaffDashboard() {
  const user = await requirePage("staff", "admin");

  const byStatus = (
    await query<{ status: string; n: number }>(
      "SELECT status, count(*)::int AS n FROM pets GROUP BY status ORDER BY n DESC"
    )
  ).rows;

  const one = async (sql: string) =>
    (await query<{ n: number }>(sql)).rows[0]?.n ?? 0;

  const pendingFosters = await one(
    "SELECT count(*)::int AS n FROM users WHERE is_approved = false AND role_id = (SELECT id FROM roles WHERE name = 'foster')"
  );

  const urgent = await one(
    "SELECT count(*)::int AS n FROM v_at_risk_pets WHERE urgency_level IN ('critical', 'high')"
  );

  const overdue = await one(
    "SELECT count(DISTINCT pet_id)::int AS n FROM v_overdue_vaccinations"
  );

  const tiles = [
    {
      title: "Fosters awaiting approval",
      count: pendingFosters,
      href: "/staff/fosters",
    },
    {
      title: "High / critical at-risk pets",
      count: urgent,
      href: "/staff/at-risk",
    },
    {
      title: "Pets with overdue vaccines",
      count: overdue,
      href: "/staff/vaccinations",
    },
  ];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-3xl font-bold">Staff dashboard</h1>

      <p className="mt-2 text-gray-600">
        Welcome, {user.fullName}. Your role: <b>{user.role}</b>.
      </p>

      <section className="mt-6 grid gap-4 sm:grid-cols-2">
        <article className="rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Application review</h2>
          <p className="mt-2 text-sm text-gray-600">
            Review submitted adoption applications and access the application
            workflow.
          </p>
          <Link
            href="/staff/applications"
            className="mt-4 inline-block rounded-md bg-teal-700 px-4 py-2 text-white hover:bg-teal-800"
          >
            Review applications
          </Link>
        </article>

        <article className="rounded-xl border border-gray-200 p-5 shadow-sm">
          <h2 className="text-xl font-semibold">Staff operations</h2>
          <p className="mt-2 text-sm text-gray-600">
            Monitor foster approvals, pet health alerts, and vaccination
            deadlines.
          </p>
        </article>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        {tiles.map((tile) => (
          <Link
            key={tile.title}
            href={tile.href}
            className="rounded-xl border border-gray-200 p-5 shadow-sm transition-shadow hover:shadow-md"
          >
            <p className="text-3xl font-bold text-teal-700">{tile.count}</p>
            <p className="mt-1 text-sm text-gray-600">{tile.title}</p>
          </Link>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-xl font-semibold">
          Pets by lifecycle stage
        </h2>

        <div className="flex flex-wrap gap-3">
          {byStatus.map((petStatus) => (
            <Link
              key={petStatus.status}
              href={`/staff/pets?status=${encodeURIComponent(petStatus.status)}`}
              className="flex items-center gap-2 rounded-xl border border-gray-200 p-4 hover:shadow-md"
            >
              <span className="rounded-full bg-teal-50 px-3 py-1 text-sm text-teal-800">
                {petStatus.status.replaceAll("_", " ")}
              </span>
              <b>{petStatus.n}</b>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
