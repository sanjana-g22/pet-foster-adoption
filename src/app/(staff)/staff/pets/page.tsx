import Link from "next/link";
import DataTable from "@/components/DataTable";
import Pagination from "@/components/Pagination";
import StatusBadge from "@/components/StatusBadge";
import { searchPets } from "@/lib/pets";
import { ageLabel, btn, btnGhost, input } from "@/lib/ui";
import { STATUSES } from "@/lib/validators/pets";

export default async function StaffPets({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const { rows, total, page, limit } = await searchPets({ q: sp.q, status: sp.status ?? "all", page: Number(sp.page ?? 1), limit: 25 });
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">All pets ({total})</h1>
        <Link href="/staff/pets/new" className={btn}>+ New intake</Link>
      </div>
      <form method="get" className="my-4 flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium">Search<input name="q" defaultValue={sp.q} className={input} /></label>
        <label className="text-sm font-medium">Status
          <select name="status" defaultValue={sp.status ?? "all"} className={input}>
            <option value="all">All</option>{STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
          </select>
        </label>
        <button className={btnGhost}>Apply</button>
      </form>
      <DataTable rows={rows} cols={[
        { h: "Name", c: (p) => <Link href={`/pets/${p.id}`} className="font-medium text-teal-800 hover:underline">{p.name}</Link> },
        { h: "Species", c: (p) => p.species }, { h: "Breed", c: (p) => p.breed ?? "-" }, { h: "Age", c: (p) => ageLabel(p.age_months) },
        { h: "Status", c: (p) => <StatusBadge status={p.status} /> }, { h: "Days in care", c: (p) => p.days_in_shelter },
        { h: "", c: (p) => <Link href={`/staff/pets/${p.id}`} className={btnGhost}>Manage</Link> },
      ]} />
      <Pagination basePath="/staff/pets" params={{ q: sp.q, status: sp.status }} page={page} total={total} limit={limit} />
    </main>
  );
}
