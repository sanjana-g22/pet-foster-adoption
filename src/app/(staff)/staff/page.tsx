
import Link from "next/link";
import { requirePage } from "@/lib/page-auth";

export default async function Page() {
  const user = await requirePage("staff", "admin");

  return (
    <main className="mx-auto max-w-5xl px-4 py-10">
      <h1 className="text-3xl font-bold">Staff dashboard</h1>
      <p className="mt-2 text-gray-600">
        Welcome, {user.fullName}. Your role: <b>{user.role}</b>.
      </p>

      <section className="mt-8 grid gap-5 sm:grid-cols-2">
        <article className="rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Application review</h2>
          <p className="mt-3 text-sm text-gray-600">
            Review submitted adoption applications and approve or reject them.
          </p>
          <Link
            href="/staff/applications"
            className="mt-5 inline-block rounded-md bg-teal-700 px-4 py-2 text-white hover:bg-teal-800"
          >
            Review applications
          </Link>
        </article>

        <article className="rounded-xl border border-gray-200 p-6 shadow-sm">
          <h2 className="text-xl font-semibold">Adoption analytics</h2>
          <p className="mt-3 text-sm text-gray-600">
            Application counts, adoption progress and follow-up metrics are
            available to administrators.
          </p>
          <p className="mt-5 text-sm text-gray-500">
            Admin access required.
          </p>
        </article>
      </section>
    </main>
  );
}
