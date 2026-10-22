"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-16 text-center">
      <h1 className="text-2xl font-bold text-red-700">Something went wrong</h1>
      <p className="mt-2 text-gray-600">Please try again. If it keeps happening, tell a staff member.</p>
      <button onClick={reset} className="mt-6 rounded-md bg-teal-700 px-4 py-2 text-white">Try again</button>
    </main>
  );
}