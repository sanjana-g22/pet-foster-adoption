
import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { query } from "@/lib/db";

export default async function UsersPage() {
  await requirePage("admin");

  const { rows } = await query(`
    SELECT u.id, u.email, u.full_name AS "fullName",
           r.name AS role, u.is_active AS "isActive",
           u.is_approved AS "isApproved",
           u.created_at AS "createdAt"
    FROM users u
    JOIN roles r ON r.id = u.role_id
    ORDER BY u.id
  `);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/admin" className="text-teal-700">
        ← Back to admin dashboard
      </Link>

      <h1 className="mt-5 text-3xl font-bold">User management</h1>
      <p className="mt-2 text-gray-600">
        View registered accounts, roles and approval status.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-teal-50">
            <tr>
              {["ID", "Name", "Email", "Role", "Active", "Approved", "Joined"].map(
                (heading) => (
                  <th key={heading} className="p-3">{heading}</th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((user) => (
              <tr key={user.id} className="border-t">
                <td className="p-3">{user.id}</td>
                <td className="p-3">{user.fullName}</td>
                <td className="p-3">{user.email}</td>
                <td className="p-3">{user.role}</td>
                <td className="p-3">{user.isActive ? "Yes" : "No"}</td>
                <td className="p-3">{user.isApproved ? "Yes" : "No"}</td>
                <td className="p-3">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-5 text-center">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
