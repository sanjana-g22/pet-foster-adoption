import Link from "next/link";
import type { PetRow } from "@/lib/pets";
import { EMOJI, ageLabel } from "@/lib/ui";
import StatusBadge from "./StatusBadge";

export default function PetCard({ pet }: { pet: PetRow }) {
  return (
    <Link
      href={`/pets/${pet.id}`}
      className="group block overflow-hidden rounded-[24px] border border-[#e4e4d9] bg-white shadow-[0_5px_20px_rgba(36,55,45,0.04)] transition duration-200 hover:-translate-y-1 hover:shadow-[0_16px_35px_rgba(36,55,45,0.12)]"
    >
      <div className="relative h-56 overflow-hidden bg-[#e8efe7]">
        {pet.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={pet.photo_url}
            alt={pet.name}
            className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-7xl">
            {EMOJI[pet.species] ?? "🐾"}
          </div>
        )}

        <div className="absolute left-3 top-3">
          <StatusBadge status={pet.status} />
        </div>

        <div className="absolute bottom-3 right-3 rounded-full bg-white/95 px-3 py-1.5 text-xs font-bold text-[#245c45] shadow-sm">
          Meet {pet.name} →
        </div>
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-extrabold text-[#24372d] transition group-hover:text-[#3d805b]">
              {pet.name}
            </h3>

            <p className="mt-1 text-sm capitalize text-[#69756c]">
              {pet.breed ?? pet.species}
            </p>
          </div>

          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#edf3eb] text-xl">
            {EMOJI[pet.species] ?? "🐾"}
          </span>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-[#f0eee6] px-3 py-1.5 text-xs font-semibold capitalize text-[#4c5d50]">
            {ageLabel(pet.age_months)}
          </span>

          <span className="rounded-full bg-[#f0eee6] px-3 py-1.5 text-xs font-semibold capitalize text-[#4c5d50]">
            {pet.size}
          </span>
        </div>

        {(pet.good_with_kids || pet.apartment_friendly) && (
          <div className="mt-4 flex flex-wrap gap-2 border-t border-[#efeee6] pt-4">
            {pet.good_with_kids && (
              <span className="text-xs font-medium text-[#52705a]">
                ✓ Good with kids
              </span>
            )}

            {pet.apartment_friendly && (
              <span className="text-xs font-medium text-[#52705a]">
                ✓ Apartment friendly
              </span>
            )}
          </div>
        )}
      </div>
    </Link>
  );
}