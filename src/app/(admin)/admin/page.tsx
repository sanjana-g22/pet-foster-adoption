import { requirePage } from "@/lib/page-auth";

export default async function Page() {
  const user = await requirePage("admin");
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">Admin dashboard</h1>
      <p className="mt-2 text-gray-600">Welcome, {user.fullName}. Your role: <b>{user.role}</b>.</p>
      <p className="mt-6 rounded-md bg-teal-50 p-4 text-sm text-teal-900">Analytics, user management and the audit log will appear here.</p>
    </main>
  );
}
