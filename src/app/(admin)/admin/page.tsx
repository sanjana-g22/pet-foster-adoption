
import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { query } from "@/lib/db";

export default async function Page() {
  const user = await requirePage("admin");

  const [funnel, species, followups] = await Promise.all([
    query("SELECT * FROM v_adoption_funnel"),
    query("SELECT * FROM v_average_stay_by_species ORDER BY species"),
    query(
      "SELECT count(*)::int AS pending FROM followups WHERE status IN ('scheduled','overdue') AND due_date <= CURRENT_DATE"
    ),
  ]);

  const f = funnel.rows[0] ?? {};

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-teal-800">
        Admin dashboard
      </h1>
      <p className="mt-2 text-gray-600">
        Welcome, {user.fullName}. Manage the adoption platform.
      </p>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/staff/applications"
          className="rounded-xl border p-5 shadow-sm hover:bg-teal-50"
        >
          <h2 className="text-xl font-semibold">Application review</h2>
          <p className="mt-2 text-sm text-gray-600">
            View submitted applications and access review actions.
          </p>
          <p className="mt-4 font-semibold text-teal-800">
            Open applications →
          </p>
        </Link>

        <Link
          href="/admin/users"
          className="rounded-xl border p-5 shadow-sm hover:bg-teal-50"
        >
          <h2 className="text-xl font-semibold">User management</h2>
          <p className="mt-2 text-sm text-gray-600">
            View registered users, roles and account status.
          </p>
          <p className="mt-4 font-semibold text-teal-800">
            Manage users →
          </p>
        </Link>

        <Link
          href="/admin/audit-log"
          className="rounded-xl border p-5 shadow-sm hover:bg-teal-50"
        >
          <h2 className="text-xl font-semibold">Audit log</h2>
          <p className="mt-2 text-sm text-gray-600">
            Review recorded changes and actions in the system.
          </p>
          <p className="mt-4 font-semibold text-teal-800">
            View activity →
          </p>
        </Link>
      </section>

      <h2 className="mt-10 text-2xl font-bold">Adoption analytics</h2>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          ["Submitted", f.submitted],
          ["Under review", f.under_review],
          ["Approved", f.approved],
          ["Rejected", f.rejected],
          ["Overdue follow-ups", followups.rows[0]?.pending ?? 0],
        ].map(([label, value]) => (
          <div key={String(label)} className="rounded-xl border p-4">
            <p className="text-sm text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold">
              {String(value ?? 0)}
            </p>
          </div>
        ))}
      </div>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">
          Average days in the system by species
        </h2>
        <div className="mt-3 overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr>
                <th className="p-3">Species</th>
                <th className="p-3">Average days</th>
              </tr>
            </thead>
            <tbody>
              {species.rows.map((r) => (
                <tr key={r.species} className="border-t">
                  <td className="p-3">{r.species}</td>
                  <td className="p-3">{r.average_days ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
