import Link from "next/link";

export default function ForbiddenPage() {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-3xl font-bold text-red-700">403: Not allowed</h1>
      <p className="mt-3 text-gray-600">Your role does not have access to that page.</p>
      <Link href="/" className="mt-6 inline-block text-teal-700 underline">
        Back to home
      </Link>
    </main>
  );
}
