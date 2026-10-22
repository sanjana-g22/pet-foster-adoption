import Link from "next/link";
import type { PetRow } from "@/lib/pets";
import { EMOJI, ageLabel, card } from "@/lib/ui";
import StatusBadge from "./StatusBadge";

export default function PetCard({ pet }: { pet: PetRow }) {
  return (
    <Link href={`/pets/${pet.id}`} className={`${card} block transition hover:shadow-md`}>
      <div className="flex h-32 items-center justify-center overflow-hidden rounded-md bg-teal-50 text-6xl">
        {pet.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={pet.photo_url} alt={pet.name} className="h-full w-full object-cover" />
        ) : (
          EMOJI[pet.species] ?? "🐾"
        )}
      </div>
      <div className="mt-3 flex items-center justify-between">
        <h3 className="font-semibold">{pet.name}</h3>
        <StatusBadge status={pet.status} />
      </div>
      <p className="text-sm text-gray-600">{pet.breed ?? pet.species} · {ageLabel(pet.age_months)} · {pet.size}</p>
      <p className="mt-1 text-xs text-gray-500">
        {pet.good_with_kids ? "👶 Good with kids" : ""} {pet.apartment_friendly ? "🏢 Apartment friendly" : ""}
      </p>
    </Link>
  );
}