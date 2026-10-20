
import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { query } from "@/lib/db";

export default async function AuditLogPage() {
  await requirePage("admin");

  const { rows } = await query(`
    SELECT a.id, a.table_name AS "tableName",
           a.record_id AS "recordId", a.action::text AS action,
           a.actor_user_id AS "actorId",
           u.full_name AS "actorName",
           a.created_at AS "createdAt",
           a.old_data AS "oldData", a.new_data AS "newData"
    FROM audit_log a
    LEFT JOIN users u ON u.id = a.actor_user_id
    ORDER BY a.created_at DESC
    LIMIT 100
  `);

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <Link href="/admin" className="text-teal-700">
        ← Back to admin dashboard
      </Link>

      <h1 className="mt-5 text-3xl font-bold">Audit log</h1>
      <p className="mt-2 text-gray-600">
        The 100 most recent recorded database changes.
      </p>

      <div className="mt-6 overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-teal-50">
            <tr>
              {["Time", "Table", "Record ID", "Action", "Actor", "Details"].map(
                (heading) => (
                  <th key={heading} className="p-3">{heading}</th>
                )
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((entry) => (
              <tr key={entry.id} className="border-t align-top">
                <td className="whitespace-nowrap p-3">
                  {new Date(entry.createdAt).toLocaleString()}
                </td>
                <td className="p-3">{entry.tableName}</td>
                <td className="p-3">{entry.recordId ?? "—"}</td>
                <td className="p-3">{entry.action}</td>
                <td className="p-3">
                  {entry.actorName ?? (
                    entry.actorId ? `User ${entry.actorId}` : "System / unknown"
                  )}
                </td>
                <td className="min-w-64 p-3">
                  <details>
                    <summary className="cursor-pointer text-teal-700">
                      View changes
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-xs">
                      {JSON.stringify(
                        { old: entry.oldData, new: entry.newData },
                        null,
                        2
                      )}
                    </pre>
                  </details>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="p-5 text-center">
                  No audit entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
