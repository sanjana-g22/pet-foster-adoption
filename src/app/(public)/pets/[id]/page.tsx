import Link from "next/link";
import { notFound } from "next/navigation";
import DataTable from "@/components/DataTable";
import StatusBadge from "@/components/StatusBadge";
import { getCurrentUser } from "@/lib/auth";
import { query } from "@/lib/db";
import { PET_COLS } from "@/lib/pets";
import { EMOJI, ageLabel, btnGhost, card, fmtDate, label } from "@/lib/ui";

const PUBLIC_STATUSES = ["available", "in_foster", "adoption_pending"];

export default async function PetDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();

  const user = await getCurrentUser().catch(() => null);
  const staff = user?.role === "staff" || user?.role === "admin";

  const pet = (await query<{
    id: number; name: string; species: string; breed: string | null; sex: string; age_months: number; size: string;
    weight_kg: number; microchip_no: string | null; status: string; intake_date: string; temperament: string | null;
    description: string | null; good_with_kids: boolean; good_with_pets: boolean; apartment_friendly: boolean;
    house_trained: boolean; energy_level: number; special_needs: string | null; photo_url: string | null;
    days_in_shelter: number; fully_vaccinated: boolean;
  }>(
    `SELECT ${PET_COLS}, (CURRENT_DATE - p.intake_date) AS days_in_shelter,
            NOT EXISTS (SELECT 1 FROM required_vaccines rv WHERE rv.species = p.species AND NOT EXISTS
              (SELECT 1 FROM vaccinations v WHERE v.pet_id = p.id AND v.vaccine_name = rv.vaccine_name AND v.expires_on >= CURRENT_DATE)) AS fully_vaccinated
       FROM pets p WHERE p.id = $1`, [id])).rows[0];
  if (!pet) notFound();

  // Is this foster currently caring for this pet?
  let fosterOfPet = false;
  if (user?.role === "foster") {
    fosterOfPet = (await query("SELECT 1 FROM foster_placements WHERE pet_id=$1 AND foster_user_id=$2 AND status='active'", [id, user.id])).rows.length > 0;
  }
  if (!staff && !fosterOfPet && !PUBLIC_STATUSES.includes(pet.status)) notFound();
  const privileged = staff || fosterOfPet;

  const timeline = (await query<{ from_status: string | null; to_status: string; changed_at: Date; changed_by_name: string | null; note: string | null }>(
    "SELECT from_status, to_status, changed_at, changed_by_name, note FROM v_pet_timeline WHERE pet_id=$1 ORDER BY changed_at, history_id", [id])).rows;
  const vaccinations = privileged ? (await query<{ vaccine_name: string; vaccinated_on: string; expires_on: string }>(
    "SELECT vaccine_name, vaccinated_on, expires_on FROM vaccinations WHERE pet_id=$1 ORDER BY vaccinated_on DESC", [id])).rows : [];
  const medical = privileged ? (await query<{ record_type: string; record_date: string; diagnosis: string | null; treatment: string | null; vet_name: string | null }>(
    "SELECT record_type, record_date, diagnosis, treatment, vet_name FROM medical_records WHERE pet_id=$1 ORDER BY record_date DESC", [id])).rows : [];

  const tags = [
    pet.good_with_kids && "👶 Good with kids", pet.good_with_pets && "🐾 Good with other pets",
    pet.apartment_friendly && "🏢 Apartment friendly", pet.house_trained && "🏠 House trained",
  ].filter(Boolean) as string[];

  return (
    <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-3">
      <section className="space-y-4 lg:col-span-2">
        <div className={card}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-3xl font-bold">{EMOJI[pet.species]} {pet.name}</h1>
            <div className="flex items-center gap-2">
              <StatusBadge status={pet.status} />
              {staff && <Link href={`/staff/pets/${pet.id}`} className={btnGhost}>Manage</Link>}
              {privileged && <Link href={`/pets/${pet.id}/passport`} className={btnGhost}>Passport</Link>}
            </div>
          </div>
          <p className="mt-1 text-gray-600">{pet.breed ?? pet.species} · {ageLabel(pet.age_months)} · {pet.size} · {pet.sex} · {pet.weight_kg} kg</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {tags.map((t) => <span key={t} className="rounded-full bg-teal-50 px-3 py-1 text-xs text-teal-800">{t}</span>)}
            <span className={`rounded-full px-3 py-1 text-xs ${pet.fully_vaccinated ? "bg-green-50 text-green-800" : "bg-red-50 text-red-700"}`}>
              {pet.fully_vaccinated ? "💉 Fully vaccinated" : "💉 Vaccinations pending"}
            </span>
          </div>
          {pet.description && <p className="mt-4 leading-relaxed">{pet.description}</p>}
          <dl className="mt-4 grid grid-cols-2 gap-2 text-sm text-gray-600">
            <div>Temperament: <b>{pet.temperament ?? "-"}</b></div>
            <div>Energy level: <b>{pet.energy_level} / 5</b></div>
            <div>In our care for: <b>{pet.days_in_shelter} days</b></div>
            {pet.special_needs && <div className="col-span-2">Special needs: <b>{pet.special_needs}</b></div>}
          </dl>
        </div>

        {/* Person B: add the "Apply to adopt" button and the "Similar pets" panel here */}

        {privileged && (
          <div className={card}>
            <h2 className="mb-2 font-semibold">Medical history</h2>
            <DataTable rows={medical} empty="No medical records yet." cols={[
              { h: "Date", c: (r) => r.record_date }, { h: "Type", c: (r) => label(r.record_type) },
              { h: "Diagnosis", c: (r) => r.diagnosis ?? "-" }, { h: "Treatment", c: (r) => r.treatment ?? "-" }, { h: "Vet", c: (r) => r.vet_name ?? "-" },
            ]} />
            <h2 className="mb-2 mt-5 font-semibold">Vaccinations</h2>
            <DataTable rows={vaccinations} empty="No vaccinations recorded." cols={[
              { h: "Vaccine", c: (r) => r.vaccine_name }, { h: "Given", c: (r) => r.vaccinated_on },
              { h: "Expires", c: (r) => <span className={r.expires_on < fmtDate(new Date()) ? "text-red-600" : ""}>{r.expires_on}</span> },
            ]} />
          </div>
        )}
      </section>

      <aside className={card}>
        <h2 className="mb-3 font-semibold">Lifecycle timeline</h2>
        <ol className="relative space-y-4 border-l-2 border-teal-200 pl-5">
          {timeline.map((t, i) => (
            <li key={i} className="relative">
              <span className="absolute -left-[27px] top-1 h-3 w-3 rounded-full bg-teal-600" />
              <StatusBadge status={t.to_status} />
              <p className="mt-1 text-xs text-gray-500">{fmtDate(t.changed_at)}{staff && t.changed_by_name ? ` · ${t.changed_by_name}` : ""}</p>
              {staff && t.note && <p className="text-xs text-gray-600">{t.note}</p>}
            </li>
          ))}
        </ol>
      </aside>
    </main>
  );
}
