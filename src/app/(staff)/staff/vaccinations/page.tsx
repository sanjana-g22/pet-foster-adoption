import Link from "next/link";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { query } from "@/lib/db";

export default async function OverdueVaccinations() {
  const rows = (await query<{ pet_id: number; name: string; species: string; status: string; vaccine_name: string; last_expiry: string | null; issue: string }>(
    "SELECT pet_id, name, species, status, vaccine_name, last_expiry, issue FROM v_overdue_vaccinations ORDER BY issue DESC, name LIMIT 200")).rows;
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">Overdue vaccinations</h1>
      <p className="mb-4 text-sm text-gray-500">Required vaccines that are missing or expired. Pets with any of these cannot become Available.</p>
      <DataTable rows={rows} empty="Every pet is up to date." cols={[
        { h: "Pet", c: (r) => <Link href={`/staff/pets/${r.pet_id}`} className="font-medium text-teal-800 hover:underline">{r.name}</Link> },
        { h: "Species", c: (r) => r.species }, { h: "Status", c: (r) => <StatusBadge status={r.status} /> },
        { h: "Vaccine", c: (r) => r.vaccine_name },
        { h: "Issue", c: (r) => r.issue === "missing" ? <span className="text-red-700">Missing</span> : <span className="text-amber-700">Expired {r.last_expiry}</span> },
      ]} />
    </main>
  );
}
