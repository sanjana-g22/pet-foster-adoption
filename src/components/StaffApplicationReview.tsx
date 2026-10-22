
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Application = {
  id: number;
  status: string;
  message: string | null;
  submitted_at: string;
  pet_name: string;
  adopter_name: string;
  adopter_email: string;
};

export default function StaffApplicationReview({
  applications,
}: {
  applications: Application[];
}) {
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  async function act(id: number, action: "approve" | "reject" | "review") {
    if (action === "approve" &&
        !window.confirm("Approve this application and process the adoption?")) {
      return;
    }

    if (action === "reject" &&
        !window.confirm("Are you sure you want to reject this application?")) {
      return;
    }

    const reviewNote =
      action === "reject"
        ? window.prompt("Reason for rejection (optional):") ?? ""
        : "";

    setBusyId(id);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/staff/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: id,
          action,
          review_note: reviewNote,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ?? data.message ?? "The application could not be updated."
        );
      }

      setSuccess(
        action === "approve"
          ? `Application #${id} approved successfully.`
          : action === "reject"
            ? `Application #${id} rejected.`
            : `Application #${id} moved to review.`
      );

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong."
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="mt-6">
      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 p-3 text-red-700">
          {error}
        </p>
      )}

      {success && (
        <p role="status" className="mb-4 rounded-lg bg-teal-50 p-3 text-teal-800">
          {success}
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border">
        <table className="w-full text-left text-sm">
          <thead className="bg-gray-50">
            <tr>
              {[
                "ID",
                "Pet",
                "Adopter",
                "Message",
                "Status",
                "Submitted",
                "Actions",
              ].map((heading) => (
                <th key={heading} className="p-3">{heading}</th>
              ))}
            </tr>
          </thead>

          <tbody>
            {applications.map((app) => {
              const pending = ["submitted", "under_review"].includes(app.status);

              return (
                <tr key={app.id} className="border-t align-top">
                  <td className="p-3">{app.id}</td>
                  <td className="p-3">{app.pet_name}</td>

                  <td className="p-3">
                    {app.adopter_name}
                    <div className="text-gray-500">{app.adopter_email}</div>
                  </td>

                  <td className="max-w-xs whitespace-pre-wrap p-3">
                    {app.message || "—"}
                  </td>

                  <td className="p-3">{app.status.replaceAll("_", " ")}</td>

                  <td className="whitespace-nowrap p-3">
                    {new Date(app.submitted_at).toLocaleDateString()}
                  </td>

                  <td className="min-w-48 p-3">
                    {pending ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          disabled={busyId !== null}
                          onClick={() => act(app.id, "approve")}
                          className="rounded-md bg-teal-700 px-3 py-2 text-white disabled:opacity-50"
                        >
                          {busyId === app.id ? "Processing..." : "Approve"}
                        </button>

                        <button
                          disabled={busyId !== null}
                          onClick={() => act(app.id, "reject")}
                          className="rounded-md bg-red-600 px-3 py-2 text-white disabled:opacity-50"
                        >
                          Reject
                        </button>

                        {app.status === "submitted" && (
                          <button
                            disabled={busyId !== null}
                            onClick={() => act(app.id, "review")}
                            className="rounded-md border px-3 py-2 disabled:opacity-50"
                          >
                            Mark in review
                          </button>
                        )}
                      </div>
                    ) : (
                      <span className="text-gray-500">Processed</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {applications.length === 0 && (
              <tr>
                <td colSpan={7} className="p-6 text-center text-gray-500">
                  No applications found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
