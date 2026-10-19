import Link from "next/link";
import { notFound } from "next/navigation";
import ActionButton from "@/components/ActionButton";
import DataTable from "@/components/DataTable";
import ApiForm from "@/components/Form";
import StatusBadge from "@/components/StatusBadge";
import { query } from "@/lib/db";
import { PET_COLS, recommendFosters } from "@/lib/pets";
import { PET_FIELDS } from "@/lib/pet-fields";
import { btnGhost, card, fmtDate, label } from "@/lib/ui";
import { END_REASONS, MEDICAL_TYPES } from "@/lib/validators/pets";

// statuses staff may set by hand; the rest only move through the foster / adoption / return workflows
const MANUAL = ["medical_hold", "available"];

export default async function ManagePet({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();

  const pet = (await query<Record<string, unknown> & { id: number; name: string; status: string; species: string }>(
    `SELECT ${PET_COLS} FROM pets p WHERE p.id = $1`, [id])).rows[0];
  if (!pet) notFound();

  const next = (await query<{ to_status: string }>("SELECT to_status FROM pet_status_transitions WHERE from_status = $1::pet_status", [pet.status])).rows
    .map((r) => r.to_status).filter((s) => MANUAL.includes(s));
  const required = (await query<{ vaccine_name: string }>("SELECT vaccine_name FROM required_vaccines WHERE species = $1::species_type", [pet.species])).rows.map((r) => r.vaccine_name);
  const medical = (await query<{ record_type: string; record_date: string; diagnosis: string | null; treatment: string | null }>(
    "SELECT record_type, record_date, diagnosis, treatment FROM medical_records WHERE pet_id=$1 ORDER BY record_date DESC", [id])).rows;
  const vaccs = (await query<{ vaccine_name: string; vaccinated_on: string; expires_on: string }>(
    "SELECT vaccine_name, vaccinated_on, expires_on FROM vaccinations WHERE pet_id=$1 ORDER BY vaccinated_on DESC", [id])).rows;
  const placement = (await query<{ id: number; full_name: string; start_date: string; expected_end_date: string | null }>(
    `SELECT fp.id, u.full_name, fp.start_date, fp.expected_end_date FROM foster_placements fp JOIN users u ON u.id = fp.foster_user_id
      WHERE fp.pet_id = $1 AND fp.status = 'active'`, [id])).rows[0];
  const suggestions = pet.status === "available" ? await recommendFosters(id) : [];
  const today = fmtDate(new Date());

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{pet.name} <StatusBadge status={pet.status} /></h1>
        <div className="flex gap-2">
          <Link href={`/pets/${id}`} className={btnGhost}>Public page</Link>
          <Link href={`/pets/${id}/passport`} className={btnGhost}>Passport</Link>
        </div>
      </div>

      <section className={card}>
        <h2 className="mb-2 font-semibold">Lifecycle</h2>
        {next.length > 0 ? (
          <ApiForm fields={[{ name: "to", label: "Move to", type: "select", options: next }, { name: "note", label: "Note (optional)" }]}
            url={`/api/pets/${id}/status`} submit="Change status" />
        ) : (
          <p className="text-sm text-gray-600">No manual status change is available from <b>{label(pet.status)}</b>. Status moves through the foster, adoption and return workflows.</p>
        )}
        {(pet.status === "adopted" || pet.status === "follow_up") && (
          <div className="mt-4 border-t pt-4">
            <h3 className="mb-2 text-sm font-semibold">Process a return</h3>
            <ApiForm fields={[{ name: "reason", label: "Reason for return", required: true, wide: true }]} url={`/api/pets/${id}/return`} submit="Mark as returned" />
          </div>
        )}
      </section>

      <section className={card}>
        <h2 className="mb-2 font-semibold">Foster</h2>
        {placement ? (
          <>
            <p className="mb-3 text-sm">Currently with <b>{placement.full_name}</b> since {placement.start_date}{placement.expected_end_date ? ` (expected until ${placement.expected_end_date})` : ""}.</p>
            <ApiForm fields={[{ name: "reason", label: "End placement because", type: "select", options: [...END_REASONS] }]} url={`/api/placements/${placement.id}/end`} submit="End placement" />
          </>
        ) : pet.status === "available" ? (
          suggestions.length === 0 ? <p className="text-sm text-gray-500">No approved foster home has a free slot.</p> : (
            <div className="grid gap-3 sm:grid-cols-3">
              {suggestions.map((s) => (
                <div key={s.id} className="rounded-md border p-3 text-sm">
                  <p className="font-semibold">{s.full_name} <span className="text-teal-700">· {s.score}/100</span></p>
                  <p className="text-xs text-gray-500">{s.city ?? ""}{s.has_yard ? " · yard" : ""}</p>
                  <ul className="my-2 list-disc pl-4 text-xs text-gray-600">{s.reasons.map((r) => <li key={r}>{r}</li>)}</ul>
                  <ActionButton url="/api/placements" body={{ petId: id, fosterId: s.id }} label="Place here" confirmText={`Place ${pet.name} with ${s.full_name}?`} />
                </div>
              ))}
            </div>
          )
        ) : <p className="text-sm text-gray-500">Fostering is offered once the pet is Available.</p>}
      </section>

      <section className={card}>
        <h2 className="mb-2 font-semibold">Vaccinations</h2>
        <p className="mb-2 text-xs text-gray-500">Required for this species: {required.join(", ") || "none"}. A pet cannot become Available until all are valid.</p>
        <DataTable rows={vaccs} empty="No vaccinations yet." cols={[
          { h: "Vaccine", c: (v) => v.vaccine_name }, { h: "Given", c: (v) => v.vaccinated_on },
          { h: "Expires", c: (v) => <span className={v.expires_on < today ? "text-red-600" : ""}>{v.expires_on}</span> },
        ]} />
        <div className="mt-4">
          <ApiForm
            fields={[
              required.length ? { name: "vaccineName", label: "Vaccine", type: "select", options: required } : { name: "vaccineName", label: "Vaccine", required: true },
              { name: "vaccinatedOn", label: "Given on", type: "date", required: true },
              { name: "expiresOn", label: "Expires on (default: +1 year)", type: "date" },
              { name: "administeredBy", label: "Administered by" },
            ]}
            url={`/api/pets/${id}/vaccinations`} submit="Add vaccination" resetOnSuccess />
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-2 font-semibold">Medical records</h2>
        <DataTable rows={medical} empty="No medical records yet." cols={[
          { h: "Date", c: (m) => m.record_date }, { h: "Type", c: (m) => label(m.record_type) },
          { h: "Diagnosis", c: (m) => m.diagnosis ?? "-" }, { h: "Treatment", c: (m) => m.treatment ?? "-" },
        ]} />
        <div className="mt-4">
          <ApiForm
            fields={[
              { name: "recordType", label: "Type", type: "select", options: [...MEDICAL_TYPES] },
              { name: "recordDate", label: "Date (default today)", type: "date" },
              { name: "vetName", label: "Vet" }, { name: "diagnosis", label: "Diagnosis" },
              { name: "treatment", label: "Treatment", wide: true }, { name: "notes", label: "Notes", type: "textarea" },
            ]}
            url={`/api/pets/${id}/medical`} submit="Add record" resetOnSuccess />
        </div>
      </section>

      <section className={card}>
        <h2 className="mb-2 font-semibold">Edit pet details</h2>
        <ApiForm fields={PET_FIELDS} url={`/api/pets/${id}`} method="PUT" submit="Save changes"
          initial={{
            name: pet.name, species: pet.species, breed: pet.breed ?? "", sex: pet.sex, ageMonths: pet.age_months, size: pet.size,
            weightKg: pet.weight_kg, microchipNo: pet.microchip_no ?? "", intakeSource: pet.intake_source ?? "",
            energyLevel: pet.energy_level, temperament: pet.temperament ?? "", description: pet.description ?? "",
            specialNeeds: pet.special_needs ?? "", photoUrl: pet.photo_url ?? "", goodWithKids: pet.good_with_kids,
            goodWithPets: pet.good_with_pets, apartmentFriendly: pet.apartment_friendly, houseTrained: pet.house_trained,
          }} />
      </section>
    </main>
  );
}
