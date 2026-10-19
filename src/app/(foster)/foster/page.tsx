import Link from "next/link";
import ApiForm from "@/components/Form";
import { query } from "@/lib/db";
import { requirePage } from "@/lib/page-auth";
import { EMOJI, card } from "@/lib/ui";

export default async function FosterDashboard() {
  const user = await requirePage("foster");
  const cap = (await query<{ max_capacity: number; active: number; completed: number }>(
    `SELECT fp.max_capacity,
            (SELECT count(*) FROM foster_placements WHERE foster_user_id = fp.user_id AND status = 'active') AS active,
            (SELECT count(*) FROM foster_placements WHERE foster_user_id = fp.user_id AND status = 'completed') AS completed
       FROM foster_profiles fp WHERE fp.user_id = $1`, [user.id])).rows[0];
  const placements = (await query<{ id: number; pet_id: number; name: string; species: string; start_date: string; expected_end_date: string | null }>(
    `SELECT fp.id, p.id AS pet_id, p.name, p.species, fp.start_date, fp.expected_end_date
       FROM foster_placements fp JOIN pets p ON p.id = fp.pet_id
      WHERE fp.foster_user_id = $1 AND fp.status = 'active' ORDER BY fp.start_date`, [user.id])).rows;
  const updates = (await query<{ placement_id: number; update_date: string; behaviour_note: string | null; health_note: string | null }>(
    `SELECT fu.placement_id, fu.update_date, fu.behaviour_note, fu.health_note
       FROM foster_updates fu JOIN foster_placements fp ON fp.id = fu.placement_id
      WHERE fp.foster_user_id = $1 ORDER BY fu.update_date DESC, fu.id DESC LIMIT 30`, [user.id])).rows;

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <h1 className="text-2xl font-bold">Foster dashboard</h1>
      {!user.isApproved && (
        <p className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">Your foster account is awaiting staff approval. You can be assigned pets once it is approved.</p>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={card}><p className="text-3xl font-bold text-teal-700">{cap?.active ?? 0} / {cap?.max_capacity ?? 0}</p><p className="text-sm text-gray-600">Pets in your care / capacity</p></div>
        <div className={card}><p className="text-3xl font-bold text-teal-700">{Math.max(0, (cap?.max_capacity ?? 0) - (cap?.active ?? 0))}</p><p className="text-sm text-gray-600">Free slots</p></div>
        <div className={card}><p className="text-3xl font-bold text-teal-700">{cap?.completed ?? 0}</p><p className="text-sm text-gray-600">Past placements</p></div>
      </div>

      <h2 className="text-xl font-semibold">My placements</h2>
      {placements.length === 0 && <p className="rounded-md bg-gray-50 p-6 text-center text-sm text-gray-500">No pets with you right now.</p>}
      {placements.map((p) => (
        <section key={p.id} className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-lg font-semibold">{EMOJI[p.species]} {p.name}</h3>
            <div className="flex gap-3 text-sm">
              <Link href={`/pets/${p.pet_id}`} className="text-teal-800 underline">Pet page</Link>
              <Link href={`/pets/${p.pet_id}/passport`} className="text-teal-800 underline">Passport</Link>
            </div>
          </div>
          <p className="text-sm text-gray-500">Since {p.start_date}{p.expected_end_date ? ` · expected until ${p.expected_end_date}` : ""}</p>
          <ul className="my-3 space-y-1 text-sm">
            {updates.filter((u) => u.placement_id === p.id).slice(0, 3).map((u, i) => (
              <li key={i} className="rounded bg-gray-50 p-2"><b>{u.update_date}</b> · {u.behaviour_note ?? ""} {u.health_note ?? ""}</li>
            ))}
          </ul>
          <h4 className="mb-2 text-sm font-semibold">Log today&apos;s update</h4>
          <ApiForm
            fields={[
              { name: "weightKg", label: "Weight (kg)", type: "number", step: "0.01", min: 0 },
              { name: "behaviourNote", label: "Behaviour", type: "textarea" }, { name: "healthNote", label: "Health", type: "textarea" },
            ]}
            url={`/api/placements/${p.id}/updates`} submit="Save update" resetOnSuccess />
        </section>
      ))}
    </main>
  );
}
