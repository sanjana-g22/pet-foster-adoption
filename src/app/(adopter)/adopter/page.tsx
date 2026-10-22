import Link from "next/link";
import { requirePage } from "@/lib/page-auth";
import { query } from "@/lib/db";

export default async function Page() {
  const user = await requirePage("adopter");
  const [apps, followups, profile] = await Promise.all([
    query(
      `SELECT a.id, a.status, a.submitted_at, p.name AS pet_name, p.species
       FROM applications a JOIN pets p ON p.id=a.pet_id
       WHERE a.adopter_user_id=$1 ORDER BY a.submitted_at DESC LIMIT 8`, [user.id]),
    query(
      `SELECT f.id, f.due_date, f.day_number, f.status, p.name AS pet_name
       FROM followups f JOIN adoptions a ON a.id=f.adoption_id JOIN pets p ON p.id=a.pet_id
       WHERE a.adopter_user_id=$1 ORDER BY f.due_date LIMIT 8`, [user.id]),
    query("SELECT * FROM adopter_profiles WHERE user_id=$1", [user.id])
  ]);
  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold text-teal-800">Your adoption dashboard</h1>
      <p className="mt-2 text-gray-600">Welcome, {user.fullName}. Keep your profile updated to improve your matches.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <Link href="/adopter/profile" className="rounded-xl border p-5 hover:bg-teal-50"><h2 className="font-semibold">Adopter profile</h2><p className="mt-2 text-sm text-gray-600">{profile.rows.length ? "Your profile is saved." : "Add your home and lifestyle details."}</p></Link>
        <Link href="/adopter/matches" className="rounded-xl border p-5 hover:bg-teal-50"><h2 className="font-semibold">Pawfect Match</h2><p className="mt-2 text-sm text-gray-600">Find pets that fit your lifestyle.</p></Link>
        <Link href="/adopter/applications" className="rounded-xl border p-5 hover:bg-teal-50"><h2 className="font-semibold">My applications</h2><p className="mt-2 text-sm text-gray-600">Track submitted applications.</p></Link>
      </div>
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Recent applications</h2>
        {apps.rows.length ? <div className="mt-3 overflow-x-auto"><table className="w-full text-left text-sm"><thead><tr><th className="p-2">Pet</th><th className="p-2">Status</th><th className="p-2">Submitted</th></tr></thead><tbody>{apps.rows.map((a) => <tr key={a.id} className="border-t"><td className="p-2">{a.pet_name} ({a.species})</td><td className="p-2">{a.status}</td><td className="p-2">{new Date(a.submitted_at).toLocaleDateString()}</td></tr>)}</tbody></table></div> : <p className="mt-3 text-sm text-gray-500">No applications yet.</p>}
      </section>
      <section className="mt-10">
        <h2 className="text-xl font-semibold">Follow-ups</h2>
        {followups.rows.length ? <ul className="mt-3 space-y-2">{followups.rows.map((f) => <li key={f.id} className="rounded-lg border p-3 text-sm">{f.pet_name} · Day {f.day_number} · due {new Date(f.due_date).toLocaleDateString()} · {f.status}</li>)}</ul> : <p className="mt-3 text-sm text-gray-500">Your post-adoption check-ins will appear here after an adoption.</p>}
      </section>
    </main>
  );
}
