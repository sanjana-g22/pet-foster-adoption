
import { requirePage } from "@/lib/page-auth";
import { query } from "@/lib/db";
import StaffApplicationActions from "@/components/StaffApplicationActions";

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

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-teal-800">
        Application review queue
      </h1>

      <p className="mt-2 text-gray-600">
        Review applications and approve or reject through the protected API.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              {[
                "ID",
                "Pet",
                "Adopter",
                "Message",
                "Status",
                "Submitted",
                "Actions",
              ].map((heading) => (
                <th key={heading} className="p-3">
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {result.rows.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-3">{a.id}</td>
                <td className="p-3">{a.pet_name}</td>

                <td className="p-3">
                  {a.adopter_name}
                  <div className="text-gray-500">{a.adopter_email}</div>
                </td>

                <td className="max-w-sm p-3">{a.message || "—"}</td>
                <td className="p-3">{a.status}</td>

                <td className="p-3">
                  {new Date(a.submitted_at).toLocaleDateString()}
                </td>

                <td className="p-3">
                  <StaffApplicationActions
                    applicationId={a.id}
                    status={a.status}
                  />
                </td>
              </tr>
            ))}

            {result.rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No applications found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
