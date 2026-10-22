import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 text-center">
      <h1 className="text-4xl font-bold text-teal-800">Pet Foster &amp; Adoption Lifecycle</h1>
      <p className="mt-4 text-lg text-gray-600">
        From intake to a forever home: foster care, medical records, matching and follow-ups in one place.
      </p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/pets" className="rounded-md bg-teal-700 px-5 py-2 font-medium text-white hover:bg-teal-800">Browse pets</Link>
        <Link href="/register" className="rounded-md border border-teal-700 px-5 py-2 font-medium text-teal-800 hover:bg-teal-50">Create account</Link>
      </div>
    </main>
  );
}
