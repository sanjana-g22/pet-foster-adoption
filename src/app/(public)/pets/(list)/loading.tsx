export default function Loading() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-52 animate-pulse rounded-lg bg-gray-100" />)}
      </div>
    </main>
  );
}
