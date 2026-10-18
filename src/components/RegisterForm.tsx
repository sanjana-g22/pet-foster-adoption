"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { ROLE_HOME, type Role } from "@/lib/roles";

interface FieldIssue {
  field: string;
  message: string;
}

export default function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: "",
    email: "",
    phone: "",
    password: "",
    role: "adopter",
  });
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<FieldIssue[]>([]);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setIssues([]);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) {
        setError(body.error ?? "Registration failed");
        if (Array.isArray(body.details)) setIssues(body.details as FieldIssue[]);
        return;
      }
      router.push(ROLE_HOME[body.data.role as Role]);
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  const input = "mt-1 w-full rounded-md border border-gray-300 px-3 py-2";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          <p>{error}</p>
          {issues.length > 0 && (
            <ul className="mt-1 list-disc pl-5">
              {issues.map((i, n) => (
                <li key={n}>
                  {i.field}: {i.message}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <label className="block text-sm font-medium">
        Full name
        <input required value={form.fullName} onChange={set("fullName")} className={input} />
      </label>
      <label className="block text-sm font-medium">
        Email
        <input type="email" required value={form.email} onChange={set("email")} className={input} />
      </label>
      <label className="block text-sm font-medium">
        Phone (optional)
        <input value={form.phone} onChange={set("phone")} className={input} />
      </label>
      <label className="block text-sm font-medium">
        Password (min 8 characters)
        <input type="password" required value={form.password} onChange={set("password")} className={input} />
      </label>
      <label className="block text-sm font-medium">
        I want to
        <select value={form.role} onChange={set("role")} className={input}>
          <option value="adopter">Adopt a pet</option>
          <option value="foster">Foster pets (needs staff approval)</option>
        </select>
      </label>
      <button
        type="submit"
        disabled={busy}
        className="w-full rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:opacity-60"
      >
        {busy ? "Creating account..." : "Create account"}
      </button>
    </form>
  );
}
