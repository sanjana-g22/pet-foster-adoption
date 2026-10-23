import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { query } from "@/lib/db";
import StatusBadge from "@/components/StatusBadge";

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
      description: "Foster accounts needing a decision",
      href: "/staff/fosters",
      icon: "⌂",
      tone: "bg-[#e8efe7] text-[#245c45]",
    },
    {
      title: "High / critical at-risk pets",
      count: urgent,
      description: "Pets that need closer attention",
      href: "/staff/at-risk",
      icon: "!",
      tone: "bg-[#f8e8dc] text-[#9a4f31]",
    },
    {
      title: "Pets with overdue vaccines",
      count: overdue,
      description: "Pets with vaccination follow-ups due",
      href: "/staff/vaccinations",
      icon: "✚",
      tone: "bg-[#e8eef8] text-[#385b91]",
    },
  ];

  return (
    <main className="min-w-0 space-y-7">
      <section className="overflow-hidden rounded-[26px] bg-[#245c45] p-6 text-white sm:p-8">
        <p className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#c9dfce]">
          Staff workspace
        </p>

        <div className="mt-3 flex flex-wrap items-end justify-between gap-5">
          <div>
            <h1 className="text-3xl font-black tracking-tight sm:text-4xl">
              Welcome back, {user.fullName}.
            </h1>

            <p className="mt-3 max-w-xl leading-7 text-[#e0ece2]">
              Here is your overview of pet care, foster approvals and the
              adoption journey. Thank you for being part of every happy ending.
            </p>
          </div>

          <span className="rounded-full border border-white/20 bg-white/10 px-4 py-2 text-sm font-semibold capitalize">
            {user.role} account
          </span>
        </div>
      </section>

      <section>
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="section-eyebrow">Your overview</p>
            <h2 className="mt-1 text-xl font-extrabold text-[#24372d]">
              Care and follow-ups
            </h2>
          </div>

          <p className="text-sm text-[#69756c]">
            Current database totals
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {tiles.map((tile) => (
            <Link
              key={tile.title}
              href={tile.href}
              className="group rounded-[22px] border border-[#e4e4d9] bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <span
                  className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-black ${tile.tone}`}
                >
                  {tile.icon}
                </span>

                <span className="text-lg text-[#a1aa9e] transition group-hover:translate-x-1 group-hover:text-[#245c45]">
                  →
                </span>
              </div>

              <p className="mt-5 text-4xl font-black tracking-tight text-[#24372d]">
                {tile.count}
              </p>

              <h3 className="mt-2 font-bold text-[#405246]">
                {tile.title}
              </h3>

              <p className="mt-2 text-sm leading-6 text-[#69756c]">
                {tile.description}
              </p>
            </Link>
          ))}
        </div>
      </section>

      <section className="rounded-[24px] border border-[#e4e4d9] bg-white p-5 shadow-sm sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="section-eyebrow">Adoption journey</p>
            <h2 className="mt-1 text-xl font-extrabold text-[#24372d]">
              Application review
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-[#69756c]">
              Review submitted adoption applications and process the next
              steps through the protected application workflow.
            </p>
          </div>

          <Link href="/staff/applications" className="primary-button">
            Review applications →
          </Link>
        </div>
      </section>

      <section className="rounded-[24px] border border-[#e4e4d9] bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-5">
          <p className="section-eyebrow">Pet records</p>
          <h2 className="mt-1 text-xl font-extrabold text-[#24372d]">
            Pets by lifecycle stage
          </h2>

          <p className="mt-2 text-sm text-[#69756c]">
            Select a stage to view the related pet records.
          </p>
        </div>

        {byStatus.length === 0 ? (
          <p className="rounded-xl bg-[#faf8f2] p-5 text-sm text-[#69756c]">
            No pet records are available yet.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {byStatus.map((petStatus) => (
              <Link
                key={petStatus.status}
                href={`/staff/pets?status=${encodeURIComponent(petStatus.status)}`}
                className="flex items-center justify-between gap-3 rounded-2xl border border-[#e9e7dc] p-4 transition hover:border-[#b7cdb9] hover:bg-[#fafcf9]"
              >
                <div className="min-w-0">
                  <StatusBadge status={petStatus.status} />
                  <p className="mt-2 text-xs text-[#69756c]">
                    View pet records
                  </p>
                </div>

                <span className="text-2xl font-extrabold text-[#245c45]">
                  {petStatus.n}
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}