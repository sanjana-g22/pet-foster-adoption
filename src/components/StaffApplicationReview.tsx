
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  applicationId: number;
  status: string;
};

export default function StaffApplicationReview({
  applicationId,
  status,
}: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const router = useRouter();

  async function act(action: "approve" | "reject" | "review") {
    if (busy) return;

    if (
      action === "approve" &&
      !window.confirm(
        "Approve this application and process the adoption?"
      )
    ) {
      return;
    }

    if (
      action === "reject" &&
      !window.confirm(
        "Are you sure you want to reject this application?"
      )
    ) {
      return;
    }

    const reviewNote =
      action === "reject"
        ? window.prompt("Reason for rejection (optional):") ?? ""
        : "";

    setBusy(true);
    setError("");
    setSuccess("");

    try {
      const response = await fetch("/api/staff/applications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          application_id: applicationId,
          action,
          review_note: reviewNote,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error ??
            data.message ??
            "The application could not be updated."
        );
      }

      setSuccess(
        action === "approve"
          ? `Application #${applicationId} approved successfully.`
          : action === "reject"
            ? `Application #${applicationId} rejected.`
            : `Application #${applicationId} moved to review.`
      );

      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong."
      );
    } finally {
      setBusy(false);
    }
  }

  const pending = ["submitted", "under_review"].includes(status);

  return (
    <div className="min-w-48 space-y-2">
      {error && (
        <p role="alert" className="text-sm text-red-700">
          {error}
        </p>
      )}

      {success && (
        <p role="status" className="text-sm text-teal-800">
          {success}
        </p>
      )}

      {pending ? (
        <div className="flex flex-wrap gap-2">
          <button
            disabled={busy}
            onClick={() => act("approve")}
            className="rounded-md bg-teal-700 px-3 py-2 text-white disabled:opacity-50"
          >
            {busy ? "Processing..." : "Approve"}
          </button>

          <button
            disabled={busy}
            onClick={() => act("reject")}
            className="rounded-md bg-red-600 px-3 py-2 text-white disabled:opacity-50"
          >
            Reject
          </button>

          {status === "submitted" && (
            <button
              disabled={busy}
              onClick={() => act("review")}
              className="rounded-md border px-3 py-2 disabled:opacity-50"
            >
              Mark in review
            </button>
          )}
        </div>
      ) : (
        <span className="text-gray-500">Processed</span>
      )}
    </div>
  );
}
