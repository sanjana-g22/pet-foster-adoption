import Link from "next/link";
import { btnGhost } from "@/lib/ui";

export default function Pagination({ basePath, params, page, total, limit }: {
  basePath: string; params: Record<string, string | undefined>; page: number; total: number; limit: number;
}) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const href = (p: number) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) if (v) sp.set(k, v);
    sp.set("page", String(p));
    return `${basePath}?${sp.toString()}`;
  };
  if (pages <= 1) return null;
  return (
    <div className="mt-6 flex items-center justify-center gap-3 text-sm">
      {page > 1 && <Link href={href(page - 1)} className={btnGhost}>← Previous</Link>}
      <span>Page {page} of {pages}</span>
      {page < pages && <Link href={href(page + 1)} className={btnGhost}>Next →</Link>}
    </div>
  );
}