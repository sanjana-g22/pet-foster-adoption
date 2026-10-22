import Pagination from "@/components/Pagination";
import PetCard from "@/components/PetCard";
import { searchPets } from "@/lib/pets";
import { btn, input } from "@/lib/ui";

type SP = Promise<Record<string, string | undefined>>;

export default async function BrowsePage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const { rows, total, page, limit } = await searchPets({
    q: sp.q, species: sp.species, size: sp.size, age: sp.age, kids: sp.kids, page: Number(sp.page ?? 1), limit: 12,
  });

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold">Pets looking for a home</h1>

      {/* Plain GET form: no JavaScript needed, filters live in the URL */}
      <form method="get" className="mt-4 grid gap-3 rounded-lg border border-gray-200 bg-white p-4 sm:grid-cols-6">
        <label className="text-sm font-medium sm:col-span-2">Search
          <input name="q" defaultValue={sp.q} placeholder="e.g. gentle senior cat" className={input} />
        </label>
        <label className="text-sm font-medium">Species
          <select name="species" defaultValue={sp.species ?? ""} className={input}>
            <option value="">Any</option><option value="dog">Dog</option><option value="cat">Cat</option>
            <option value="rabbit">Rabbit</option><option value="other">Other</option>
          </select>
        </label>
        <label className="text-sm font-medium">Size
          <select name="size" defaultValue={sp.size ?? ""} className={input}>
            <option value="">Any</option><option value="small">Small</option><option value="medium">Medium</option><option value="large">Large</option>
          </select>
        </label>
        <label className="text-sm font-medium">Age
          <select name="age" defaultValue={sp.age ?? ""} className={input}>
            <option value="">Any</option><option value="baby">Baby (under 1 yr)</option><option value="adult">Adult</option><option value="senior">Senior (8+ yrs)</option>
          </select>
        </label>
        <div className="flex items-end gap-3">
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="kids" value="1" defaultChecked={sp.kids === "1"} /> Kid-safe</label>
          <button type="submit" className={btn}>Filter</button>
        </div>
      </form>

      <p className="mt-4 text-sm text-gray-500">{total} pet{total === 1 ? "" : "s"} found</p>
      {rows.length === 0 ? (
        <p className="mt-6 rounded-md bg-gray-50 p-8 text-center text-gray-500">No pets match those filters. Try widening your search.</p>
      ) : (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{rows.map((p) => <PetCard key={p.id} pet={p} />)}</div>
      )}
      <Pagination basePath="/pets" params={{ q: sp.q, species: sp.species, size: sp.size, age: sp.age, kids: sp.kids }} page={page} total={total} limit={limit} />
    </main>
  );
}
