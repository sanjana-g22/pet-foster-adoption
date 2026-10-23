import Pagination from "@/components/Pagination";
import PetCard from "@/components/PetCard";
import { searchPets } from "@/lib/pets";
import { btn, input } from "@/lib/ui";

type SP = Promise<Record<string, string | undefined>>;

export default async function BrowsePage({
  searchParams,
}: {
  searchParams: SP;
}) {
  const sp = await searchParams;

  const { rows, total, page, limit } = await searchPets({
    q: sp.q,
    species: sp.species,
    size: sp.size,
    age: sp.age,
    kids: sp.kids,
    page: Number(sp.page ?? 1),
    limit: 12,
  });

  return (
    <main className="min-h-screen py-10 sm:py-14">
      <div className="page-shell">
        <section className="relative overflow-hidden rounded-[30px] bg-[#e8efe7] px-6 py-9 sm:px-10 sm:py-12">
          <div className="relative z-10 max-w-2xl">
            <p className="section-eyebrow">Meet your new best friend</p>

            <h1 className="mt-3 text-4xl font-black tracking-tight text-[#24372d] sm:text-5xl">
              Every good story starts with a hello.
            </h1>

            <p className="mt-4 max-w-xl leading-7 text-[#586b5c]">
              Get to know the pets waiting for a loving home. Filter by what
              matters to you and find a companion who fits your life.
            </p>

            <div className="mt-6 inline-flex rounded-full bg-white px-4 py-2 text-sm font-bold text-[#245c45] shadow-sm">
              🐾 {total} {total === 1 ? "pet" : "pets"} to explore
            </div>
          </div>

          <div
            aria-hidden="true"
            className="absolute -right-12 -top-20 h-64 w-64 rounded-full border-[35px] border-white/30"
          />
          <div
            aria-hidden="true"
            className="absolute -bottom-20 right-36 h-44 w-44 rounded-full bg-[#c9dfce]/60"
          />
        </section>

        <section className="mt-8 rounded-[24px] border border-[#e4e4d9] bg-white p-5 shadow-sm sm:p-6">
          <div className="mb-5">
            <h2 className="text-lg font-extrabold text-[#24372d]">
              Find the right match
            </h2>

            <p className="mt-1 text-sm text-[#69756c]">
              Use the filters below to narrow down your search.
            </p>
          </div>

          <form
            method="get"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6"
          >
            <label className="text-sm font-semibold text-[#405246] sm:col-span-2">
              Search
              <input
                name="q"
                defaultValue={sp.q}
                placeholder="Try 'gentle senior cat'"
                className={input}
              />
            </label>

            <label className="text-sm font-semibold text-[#405246]">
              Species
              <select
                name="species"
                defaultValue={sp.species ?? ""}
                className={input}
              >
                <option value="">Any species</option>
                <option value="dog">Dog</option>
                <option value="cat">Cat</option>
                <option value="rabbit">Rabbit</option>
                <option value="other">Other</option>
              </select>
            </label>

            <label className="text-sm font-semibold text-[#405246]">
              Size
              <select
                name="size"
                defaultValue={sp.size ?? ""}
                className={input}
              >
                <option value="">Any size</option>
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </label>

            <label className="text-sm font-semibold text-[#405246]">
              Age
              <select
                name="age"
                defaultValue={sp.age ?? ""}
                className={input}
              >
                <option value="">Any age</option>
                <option value="baby">Baby (under 1 yr)</option>
                <option value="adult">Adult</option>
                <option value="senior">Senior (8+ yrs)</option>
              </select>
            </label>

            <div className="flex flex-wrap items-end gap-3 sm:col-span-2 lg:col-span-1">
              <label className="flex items-center gap-2 pb-3 text-sm font-medium text-[#405246]">
                <input
                  type="checkbox"
                  name="kids"
                  value="1"
                  defaultChecked={sp.kids === "1"}
                  className="h-4 w-4 accent-[#245c45]"
                />
                Kid-safe
              </label>

              <button type="submit" className={btn}>
                Search
              </button>
            </div>
          </form>
        </section>

        <section className="mt-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="section-eyebrow">Your potential best friend</p>

              <h2 className="mt-2 text-2xl font-extrabold text-[#24372d]">
                Pets looking for a home
              </h2>
            </div>

            <p className="text-sm text-[#69756c]">
              Showing {rows.length} of {total}{" "}
              {total === 1 ? "pet" : "pets"}
            </p>
          </div>

          {rows.length === 0 ? (
            <div className="mt-6 rounded-[24px] border border-dashed border-[#cbd8cc] bg-white px-6 py-14 text-center">
              <div className="text-5xl">🐾</div>

              <h3 className="mt-4 text-xl font-bold text-[#24372d]">
                No matches just yet
              </h3>

              <p className="mx-auto mt-2 max-w-md leading-6 text-[#69756c]">
                Try changing a filter or using a broader search. Your perfect
                companion may be waiting under a different search.
              </p>

              <a href="/pets" className="primary-button mt-5">
                Clear filters
              </a>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {rows.map((pet) => (
                <PetCard key={pet.id} pet={pet} />
              ))}
            </div>
          )}

          <div className="mt-8">
            <Pagination
              basePath="/pets"
              params={{
                q: sp.q,
                species: sp.species,
                size: sp.size,
                age: sp.age,
                kids: sp.kids,
              }}
              page={page}
              total={total}
              limit={limit}
            />
          </div>
        </section>
      </div>
    </main>
  );
}