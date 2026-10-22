import Link from "next/link";
import ActionButton from "@/components/ActionButton";
import DataTable from "@/components/DataTable";
import { query } from "@/lib/db";

export default async function FostersPage() {
  const fosters = (await query<{ user_id: number; full_name: string; email: string; is_approved: boolean; max_capacity: number; active_placements: number; free_slots: number; utilisation_pct: number }>(
    "SELECT user_id, full_name, email, is_approved, max_capacity, active_placements, free_slots, utilisation_pct FROM v_foster_capacity WHERE is_active ORDER BY is_approved, full_name")).rows;
  const active = (await query<{ pet_id: number; pet: string; foster: string; start_date: string; expected_end_date: string | null }>(
    `SELECT p.id AS pet_id, p.name AS pet, u.full_name AS foster, fp.start_date, fp.expected_end_date
       FROM foster_placements fp JOIN pets p ON p.id = fp.pet_id JOIN users u ON u.id = fp.foster_user_id
      WHERE fp.status = 'active' ORDER BY fp.start_date`)).rows;

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-8">
      <section>
        <h1 className="mb-3 text-2xl font-bold">Foster homes</h1>
        <DataTable rows={fosters} cols={[
          { h: "Name", c: (f) => <span className="font-medium">{f.full_name}</span> }, { h: "Email", c: (f) => f.email },
          { h: "Capacity", c: (f) => `${f.active_placements} / ${f.max_capacity}` },
          { h: "Utilisation", c: (f) => `${f.utilisation_pct}%` },
          { h: "Account", c: (f) => f.is_approved ? <span className="text-green-700">Approved</span> : <span className="font-semibold text-amber-700">Awaiting approval</span> },
          { h: "", c: (f) => f.is_approved
              ? <ActionButton ghost url={`/api/fosters/${f.user_id}/approve`} body={{ approved: false }} label="Revoke" confirmText={`Revoke ${f.full_name}?`} />
              : <ActionButton url={`/api/fosters/${f.user_id}/approve`} body={{ approved: true }} label="Approve" /> },
        ]} />
      </section>
      <section>
        <h2 className="mb-3 text-xl font-semibold">Active placements</h2>
        <DataTable rows={active} empty="No pets are in foster right now." cols={[
          { h: "Pet", c: (a) => <Link href={`/staff/pets/${a.pet_id}`} className="font-medium text-teal-800 hover:underline">{a.pet}</Link> },
          { h: "Foster", c: (a) => a.foster }, { h: "Since", c: (a) => a.start_date }, { h: "Expected end", c: (a) => a.expected_end_date ?? "-" },
        ]} />
        <p className="mt-2 text-xs text-gray-500">To place a pet, open it from All pets (it must be Available) and pick a recommended foster.</p>
      </section>
    </main>
  );
}
