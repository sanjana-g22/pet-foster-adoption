import { STATUS_STYLE, label } from "@/lib/ui";

export default function StatusBadge({ status }: { status: string }) {
  const style =
    STATUS_STYLE[status] ?? "bg-gray-100 text-gray-700 ring-gray-200";

  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-bold capitalize ring-1 ring-inset ${style}`}
    >
      <span
        aria-hidden="true"
        className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current"
      />
      {label(status)}
    </span>
  );
}