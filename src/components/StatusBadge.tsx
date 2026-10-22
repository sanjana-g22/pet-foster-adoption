import { STATUS_STYLE, label } from "@/lib/ui";

export default function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[status] ?? "bg-gray-100 text-gray-700"}`}>
      {label(status)}
    </span>
  );
}