import { requirePage } from "@/lib/page-auth";
import { query } from "@/lib/db";

export default async function Page() {
  await requirePage("staff", "admin");
  const result = await query(
    `SELECT a.id, a.status, a.message, a.submitted_at, p.name AS pet_name,
            u.full_name AS adopter_name, u.email AS adopter_email
     FROM applications a JOIN pets p ON p.id=a.pet_id JOIN users u ON u.id=a.adopter_user_id
     ORDER BY CASE WHEN a.status IN ('submitted','under_review') THEN 0 ELSE 1 END, a.submitted_at`
  );
  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-bold text-teal-800">Application review queue</h1>
      <p className="mt-2 text-gray-600">Review applications and approve or reject through the protected API.</p>
      <div className="mt-6 overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm"><thead className="bg-gray-50"><tr>{["ID","Pet","Adopter","Message","Status","Submitted"].map(x=><th key={x} className="p-3">{x}</th>)}</tr></thead>
          <tbody>{result.rows.map((a)=><tr key={a.id} className="border-t"><td className="p-3">{a.id}</td><td className="p-3">{a.pet_name}</td><td className="p-3">{a.adopter_name}<div className="text-gray-500">{a.adopter_email}</div></td><td className="max-w-sm p-3">{a.message}</td><td className="p-3">{a.status}</td><td className="p-3">{new Date(a.submitted_at).toLocaleDateString()}</td></tr>)}</tbody>
        </table>
      </div>
      <p className="mt-4 text-sm text-gray-500">To approve/reject, use the API endpoint PATCH /api/staff/applications with JSON: {"{ application_id, action: 'approve' | 'reject' | 'review', review_note }"}.</p>
    </main>
  );
}
