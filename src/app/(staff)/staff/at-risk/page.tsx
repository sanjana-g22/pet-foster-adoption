import Link from "next/link";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { query } from "@/lib/db";

const LEVEL: Record<string, string> = { critical: "bg-red-600 text-white", high: "bg-orange-500 text-white", medium: "bg-amber-200 text-amber-900", low: "bg-gray-100 text-gray-600" };

export default async function AtRiskPage() {
  const rows = (await query<{ pet_id: number; name: string; species: string; status: string; days_in_shelter: number; urgency_score: number; urgency_level: string }>(
    "SELECT pet_id, name, species, status, days_in_shelter, urgency_score, urgency_level FROM v_at_risk_pets LIMIT 40")).rows;
  return (
    <main className="mx-auto max-w-5xl px-4 py-8">
      <h1 className="text-2xl font-bold">At-Risk board</h1>
      <p className="mb-4 text-sm text-gray-500">Ranked by urgency: long stays, missing vaccines, seniors, special needs and (once adoption applications exist) pets nobody has applied for.</p>
      <DataTable rows={rows} cols={[
        { h: "Pet", c: (r) => <Link href={`/staff/pets/${r.pet_id}`} className="font-medium text-teal-800 hover:underline">{r.name}</Link> },
        { h: "Species", c: (r) => r.species }, { h: "Status", c: (r) => <StatusBadge status={r.status} /> },
        { h: "Days in care", c: (r) => r.days_in_shelter }, { h: "Score", c: (r) => r.urgency_score },
        { h: "Level", c: (r) => <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${LEVEL[r.urgency_level]}`}>{r.urgency_level}</span> },
      ]} />
    </main>
  );
}
