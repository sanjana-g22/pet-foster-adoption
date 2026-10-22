import ApiForm from "@/components/Form";
import { PET_DEFAULTS, PET_FIELDS } from "@/lib/pet-fields";
import { card } from "@/lib/ui";

export default function NewPetPage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-8">
      <h1 className="mb-4 text-2xl font-bold">New pet intake</h1>
      <div className={card}>
        <p className="mb-3 text-sm text-gray-500">New pets always start in the <b>intake</b> stage. Vaccinations are added afterwards.</p>
        <ApiForm fields={PET_FIELDS} url="/api/pets" submit="Register pet" initial={PET_DEFAULTS} redirectTo="/staff/pets/{id}" />
      </div>
    </main>
  );
}
