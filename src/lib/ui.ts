// Shared UI styles and helpers.
// Safe to import from both server and client components.

export const input =
  "mt-1 w-full rounded-xl border border-[#d9ded5] bg-white px-3.5 py-3 text-sm text-[#24372d] outline-none transition placeholder:text-[#98a097] focus:border-[#6c9c79] focus:ring-2 focus:ring-[#c9dfce]";

export const btn =
  "inline-flex items-center justify-center rounded-full bg-[#245c45] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#194733] focus:outline-none focus:ring-2 focus:ring-[#83a78f] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60";

export const btnGhost =
  "inline-flex items-center justify-center rounded-full border border-[#d9ded5] bg-white px-4 py-2 text-sm font-semibold text-[#405246] transition hover:bg-[#edf3eb] disabled:cursor-not-allowed disabled:opacity-60";

export const card =
  "overflow-hidden rounded-[22px] border border-[#e4e4d9] bg-white p-5 shadow-[0_5px_20px_rgba(36,55,45,0.04)]";

export const STATUS_STYLE: Record<string, string> = {
  intake: "bg-slate-100 text-slate-700 ring-slate-200",
  medical_hold: "bg-red-50 text-red-700 ring-red-200",
  available: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  in_foster: "bg-sky-50 text-sky-800 ring-sky-200",
  adoption_pending: "bg-amber-50 text-amber-800 ring-amber-200",
  adopted: "bg-violet-50 text-violet-800 ring-violet-200",
  follow_up: "bg-indigo-50 text-indigo-800 ring-indigo-200",
  closed: "bg-slate-100 text-slate-700 ring-slate-200",
  returned: "bg-orange-50 text-orange-800 ring-orange-200",

  submitted: "bg-blue-50 text-blue-800 ring-blue-200",
  under_review: "bg-amber-50 text-amber-800 ring-amber-200",
  approved: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  rejected: "bg-red-50 text-red-800 ring-red-200",
  pending: "bg-amber-50 text-amber-800 ring-amber-200",
  active: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  completed: "bg-slate-100 text-slate-700 ring-slate-200",
};

export const EMOJI: Record<string, string> = {
  dog: "🐶",
  cat: "🐱",
  rabbit: "🐰",
  other: "🐹",
};

export const label = (s: string) =>
  s.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

export function ageLabel(months: number): string {
  if (months < 12) return `${months} mo`;

  const years = Math.floor(months / 12);
  const remainingMonths = months % 12;

  return remainingMonths
    ? `${years} yr ${remainingMonths} mo`
    : `${years} yr`;
}

export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "-";

  return typeof d === "string"
    ? d.slice(0, 10)
    : d.toISOString().slice(0, 10);
}