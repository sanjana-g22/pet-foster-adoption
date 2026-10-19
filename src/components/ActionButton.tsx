"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { btn, btnGhost } from "@/lib/ui";

/** One-click POST (approve, assign...) that refreshes the page and shows any server error. */
export default function ActionButton({ url, body, label, confirmText, ghost }: {
  url: string; body?: Record<string, unknown>; label: string; confirmText?: string; ghost?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    if (confirmText && !window.confirm(confirmText)) return;
    setBusy(true); setError(null);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body ?? {}) });
      const json = await res.json();
      if (!res.ok) setError(json.error ?? "Failed");
      else router.refresh();
    } catch {
      setError("Could not reach the server");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button onClick={run} disabled={busy} className={ghost ? btnGhost : btn}>{busy ? "..." : label}</button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </span>
  );
}