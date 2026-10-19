"use client";
import { btnGhost } from "@/lib/ui";

export default function PrintButton() {
  return <button onClick={() => window.print()} className={`${btnGhost} print:hidden`}>Print passport</button>;
}