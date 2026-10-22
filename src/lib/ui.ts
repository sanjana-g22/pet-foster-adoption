// Shared look-and-feel constants and tiny helpers (safe for server AND client components)
export const input = "mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm";
export const btn = "rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-60";
export const btnGhost = "rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-50 disabled:opacity-60";
export const card = "rounded-lg border border-gray-200 bg-white p-4 shadow-sm";

export const STATUS_STYLE: Record<string, string> = {
  intake: "bg-gray-100 text-gray-700",
  medical_hold: "bg-red-100 text-red-700",
  available: "bg-green-100 text-green-700",
  in_foster: "bg-blue-100 text-blue-700",
  adoption_pending: "bg-amber-100 text-amber-800",
  adopted: "bg-purple-100 text-purple-700",
  follow_up: "bg-indigo-100 text-indigo-700",
  closed: "bg-slate-200 text-slate-700",
  returned: "bg-orange-100 text-orange-800",
};

export const EMOJI: Record<string, string> = { dog: "🐶", cat: "🐱", rabbit: "🐰", other: "🐹" };

export const label = (s: string) => s.replace(/_/g, " ");

export function ageLabel(months: number): string {
  if (months < 12) return `${months} mo`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  return m ? `${y} yr ${m} mo` : `${y} yr`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "-";
  return typeof d === "string" ? d.slice(0, 10) : d.toISOString().slice(0, 10);
}