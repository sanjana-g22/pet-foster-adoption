import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-3xl font-bold">404: Not found</h1>
      <p className="mt-2 text-gray-600">We could not find what you were looking for.</p>
      <Link href="/pets" className="mt-6 inline-block text-teal-700 underline">Browse pets</Link>
    </main>
  );
}