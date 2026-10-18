"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function logout() {
    setBusy(true);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={logout}
      disabled={busy}
      className="rounded-md border border-white/40 px-3 py-1 text-sm hover:bg-white/10 disabled:opacity-60"
    >
      {busy ? "Logging out..." : "Log out"}
    </button>
  );
}
