import type { ReactNode } from "react";

export interface Col<T> {
  h: string;
  c: (row: T) => ReactNode;
}

export default function DataTable<T>({ rows, cols, empty = "Nothing to show yet." }: { rows: T[]; cols: Col<T>[]; empty?: string }) {
  if (rows.length === 0) {
    return <p className="rounded-md bg-gray-50 p-6 text-center text-sm text-gray-500">{empty}</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-500">
          <tr>{cols.map((c) => <th key={c.h} className="px-3 py-2 font-medium">{c.h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-gray-100">
              {cols.map((c) => <td key={c.h} className="px-3 py-2 align-middle">{c.c(r)}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}