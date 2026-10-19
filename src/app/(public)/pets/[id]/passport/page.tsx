import QRCode from "qrcode";
import { notFound, redirect } from "next/navigation";
import PrintButton from "@/components/PrintButton";
import StatusBadge from "@/components/StatusBadge";
import { query } from "@/lib/db";
import { PET_COLS } from "@/lib/pets";
import { requirePage } from "@/lib/page-auth";
import { EMOJI, ageLabel, card, fmtDate } from "@/lib/ui";

export default async function PassportPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("staff", "admin", "foster");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();

  // A foster may only print the passport of a pet they are currently caring for
  if (user.role === "foster") {
    const own = await query("SELECT 1 FROM foster_placements WHERE pet_id=$1 AND foster_user_id=$2 AND status='active'", [id, user.id]);
    if (own.rows.length === 0) redirect("/forbidden");
  }

  const pet = (await query<{
    id: number; name: string; species: string; breed: string | null; sex: string; age_months: number; size: string;
    weight_kg: number; microchip_no: string | null; status: string; special_needs: string | null;
  }>(`SELECT ${PET_COLS} FROM pets p WHERE p.id = $1`, [id])).rows[0];
  if (!pet) notFound();

  const vaccs = (await query<{ vaccine_name: string; vaccinated_on: string; expires_on: string }>(
    "SELECT vaccine_name, vaccinated_on, expires_on FROM vaccinations WHERE pet_id=$1 ORDER BY vaccine_name", [id])).rows;
  const notes = (await query<{ record_date: string; record_type: string; diagnosis: string | null }>(
    "SELECT record_date, record_type, diagnosis FROM medical_records WHERE pet_id=$1 AND diagnosis IS NOT NULL ORDER BY record_date DESC LIMIT 5", [id])).rows;

  // The QR code links to the public pet page (no sensitive data behind it)
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const qr = await QRCode.toDataURL(`${base}/pets/${id}`, { width: 160, margin: 1 });
  const today = fmtDate(new Date());

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <div className="mb-4 flex justify-end"><PrintButton /></div>
      <div className={`${card} border-2 border-teal-700`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-widest text-teal-700">Pet Passport</p>
            <h1 className="text-3xl font-bold">{EMOJI[pet.species]} {pet.name}</h1>
            <p className="text-gray-600">{pet.breed ?? pet.species} · {ageLabel(pet.age_months)} · {pet.size} · {pet.sex} · {pet.weight_kg} kg</p>
            <div className="mt-2 flex items-center gap-2"><StatusBadge status={pet.status} /><span className="text-sm">Microchip: <b>{pet.microchip_no ?? "not chipped"}</b></span></div>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qr} alt="QR code to this pet's page" width={120} height={120} />
        </div>

        <h2 className="mt-6 font-semibold">Vaccinations</h2>
        <table className="mt-1 w-full text-sm">
          <thead><tr className="text-left text-gray-500"><th>Vaccine</th><th>Given</th><th>Valid until</th></tr></thead>
          <tbody>
            {vaccs.length === 0 && <tr><td colSpan={3} className="py-2 text-gray-500">None recorded</td></tr>}
            {vaccs.map((v) => (
              <tr key={v.vaccine_name + v.vaccinated_on} className="border-t">
                <td className="py-1">{v.vaccine_name}</td><td>{v.vaccinated_on}</td>
                <td className={v.expires_on < today ? "font-semibold text-red-600" : ""}>{v.expires_on}{v.expires_on < today ? " (expired)" : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <h2 className="mt-6 font-semibold">Key medical notes</h2>
        <ul className="mt-1 list-disc pl-5 text-sm">
          {pet.special_needs && <li><b>Special needs:</b> {pet.special_needs}</li>}
          {notes.map((n, i) => <li key={i}>{n.record_date} · {n.record_type}: {n.diagnosis}</li>)}
          {!pet.special_needs && notes.length === 0 && <li className="list-none text-gray-500">No notes</li>}
        </ul>
        <p className="mt-6 text-xs text-gray-400">Issued {today}</p>
      </div>
    </main>
  );
}
