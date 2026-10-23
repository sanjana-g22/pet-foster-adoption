import { requirePage } from "@/lib/page-auth";
import { query } from "@/lib/db";
import StaffApplicationActions from "@/components/StaffApplicationReview";
import StatusBadge from "@/components/StatusBadge";

export default async function Page() {
  await requirePage("staff", "admin");

  const result = await query(
    `SELECT a.id, a.status, a.message, a.submitted_at,
            p.name AS pet_name,
            u.full_name AS adopter_name,
            u.email AS adopter_email
     FROM applications a
     JOIN pets p ON p.id = a.pet_id
     JOIN users u ON u.id = a.adopter_user_id
     ORDER BY
       CASE WHEN a.status IN ('submitted', 'under_review')
            THEN 0 ELSE 1 END,
       a.submitted_at`
  );

  const pendingCount = result.rows.filter((application) =>
    ["submitted", "under_review"].includes(application.status)
  ).length;

  return (
    <main className="min-w-0 space-y-6">
      <section className="rounded-[26px] border border-[#e4e4d9] bg-white p-6 shadow-sm sm:p-8">
        <p className="section-eyebrow">Adoption workflow</p>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-[#24372d]">
              Application review
            </h1>

            <p className="mt-3 max-w-2xl leading-7 text-[#69756c]">
              Review each application, read the adopter's message and decide
              on the next step. Pending applications are listed first.
            </p>
          </div>

          <div className="rounded-2xl bg-[#e8efe7] px-5 py-4">
            <p className="text-3xl font-black text-[#245c45]">
              {pendingCount}
            </p>

            <p className="mt-1 text-xs font-bold text-[#526b58]">
              Awaiting review
            </p>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-[24px] border border-[#e4e4d9] bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e9e7dc] px-5 py-4">
          <div>
            <h2 className="font-extrabold text-[#24372d]">
              All applications
            </h2>

            <p className="mt-1 text-sm text-[#69756c]">
              {result.rows.length}{" "}
              {result.rows.length === 1 ? "record" : "records"} in total
            </p>
          </div>
        </div>

        {result.rows.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="text-5xl">📋</div>

            <h3 className="mt-4 text-xl font-bold text-[#24372d]">
              No applications yet
            </h3>

            <p className="mt-2 text-sm text-[#69756c]">
              New adoption applications will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left text-sm">
              <thead className="bg-[#f6f5ef] text-xs uppercase tracking-wide text-[#69756c]">
                <tr>
                  <th className="px-5 py-4 font-bold">ID</th>
                  <th className="px-5 py-4 font-bold">Pet</th>
                  <th className="px-5 py-4 font-bold">Adopter</th>
                  <th className="px-5 py-4 font-bold">Message</th>
                  <th className="px-5 py-4 font-bold">Status</th>
                  <th className="px-5 py-4 font-bold">Submitted</th>
                  <th className="px-5 py-4 font-bold">Actions</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-[#efeee6]">
                {result.rows.map((application) => (
                  <tr
                    key={application.id}
                    className="align-top transition hover:bg-[#fcfcf9]"
                  >
                    <td className="px-5 py-5 font-bold text-[#69756c]">
                      #{application.id}
                    </td>

                    <td className="px-5 py-5">
                      <span className="font-bold text-[#24372d]">
                        {application.pet_name}
                      </span>
                    </td>

                    <td className="px-5 py-5">
                      <p className="font-semibold text-[#24372d]">
                        {application.adopter_name}
                      </p>

                      <p className="mt-1 text-xs text-[#69756c]">
                        {application.adopter_email}
                      </p>
                    </td>

                    <td className="max-w-xs whitespace-normal px-5 py-5 leading-6 text-[#69756c]">
                      {application.message || "No message provided"}
                    </td>

                    <td className="px-5 py-5">
                      <StatusBadge status={application.status} />
                    </td>

                    <td className="whitespace-nowrap px-5 py-5 text-[#69756c]">
                      {new Date(
                        application.submitted_at
                      ).toLocaleDateString()}
                    </td>

                    <td className="px-5 py-5">
                      <StaffApplicationActions
                        applicationId={application.id}
                        status={application.status}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}