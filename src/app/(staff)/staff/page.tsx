import { requirePage } from "@/lib/page-auth";

export default async function Page() {
  const user = await requirePage("staff", "admin");
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">Staff dashboard</h1>
      <p className="mt-2 text-gray-600">Welcome, {user.fullName}. Your role: <b>{user.role}</b>.</p>
      <p className="mt-6 rounded-md bg-teal-50 p-4 text-sm text-teal-900">Pet intake, medical records, foster assignment and the At-Risk board will appear here.</p>
    </main>
  );
}
