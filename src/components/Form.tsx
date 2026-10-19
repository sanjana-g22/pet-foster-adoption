"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn, input } from "@/lib/ui";

export interface Field {
  name: string;
  label: string;
  type?: "text" | "number" | "date" | "textarea" | "select" | "checkbox";
  options?: string[];
  required?: boolean;
  step?: string;
  min?: number;
  max?: number;
  wide?: boolean;
}

interface Props {
  fields: Field[];
  url: string;
  method?: "POST" | "PUT";
  initial?: Record<string, unknown>;
  submit: string;
  redirectTo?: string; // may contain {id}
  resetOnSuccess?: boolean;
}

/** One reusable form: sends JSON to an API route and shows server-side validation messages. */
export default function ApiForm({ fields, url, method = "POST", initial = {}, submit, redirectTo, resetOnSuccess }: Props) {
  const router = useRouter();
  const blank = () =>
    Object.fromEntries(fields.map((f) => [f.name, initial[f.name] ?? (f.type === "checkbox" ? false : f.type === "select" ? f.options?.[0] ?? "" : "")]));
  const [values, setValues] = useState<Record<string, unknown>>(blank);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<{ field: string; message: string }[]>([]);
  const [ok, setOk] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (name: string, v: unknown) => setValues((s) => ({ ...s, [name]: v }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setIssues([]); setOk(false);
    const body: Record<string, unknown> = {};
    for (const f of fields) {
      const v = values[f.name];
      if (f.type === "checkbox") body[f.name] = !!v;
      else if (v === "" || v === null || v === undefined) continue; // blank = omitted
      else body[f.name] = f.type === "number" ? Number(v) : v;
    }
    try {
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Something went wrong");
        if (Array.isArray(json.details)) setIssues(json.details);
        return;
      }
      if (redirectTo) { router.push(redirectTo.replace("{id}", String(json.data?.id ?? ""))); router.refresh(); return; }
      setOk(true);
      if (resetOnSuccess) setValues(blank());
      router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      {error && (
        <div className="rounded-md bg-red-50 p-3 text-sm text-red-700">
          <p>{error}</p>
          {issues.length > 0 && <ul className="mt-1 list-disc pl-5">{issues.map((i, n) => <li key={n}>{i.field}: {i.message}</li>)}</ul>}
        </div>
      )}
      {ok && <p className="rounded-md bg-green-50 p-3 text-sm text-green-700">Saved.</p>}
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => {
          const span = f.type === "textarea" || f.wide ? "sm:col-span-2" : "";
          if (f.type === "checkbox")
            return (
              <label key={f.name} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={!!values[f.name]} onChange={(e) => set(f.name, e.target.checked)} /> {f.label}
              </label>
            );
          return (
            <label key={f.name} className={`block text-sm font-medium ${span}`}>
              {f.label}
              {f.type === "textarea" ? (
                <textarea rows={3} value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} className={input} />
              ) : f.type === "select" ? (
                <select value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} className={input}>
                  {f.options?.map((o) => <option key={o} value={o}>{o.replace(/_/g, " ")}</option>)}
                </select>
              ) : (
                <input
                  type={f.type ?? "text"} required={f.required} step={f.step} min={f.min} max={f.max}
                  value={String(values[f.name] ?? "")} onChange={(e) => set(f.name, e.target.value)} className={input}
                />
              )}
            </label>
          );
        })}
      </div>
      <button type="submit" disabled={busy} className={btn}>{busy ? "Saving..." : submit}</button>
    </form>
  );
}