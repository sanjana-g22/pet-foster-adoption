// One place that turns any error into a consistent JSON response: { error, details? }
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

// Custom codes raised by our triggers / procedures (see db/migrations/020_triggers.sql)
const CUSTOM_STATUS: Record<string, number> = {
  PT001: 409, // illegal status / transition
  PT002: 409, // vaccination gate
  PT003: 409, // foster capacity exceeded
  PT004: 409, // invalid foster account / profile
  PT005: 404, // record not found
  PT006: 409, // placement not active
};

// PostgreSQL standard codes
const STANDARD: Record<string, [number, string]> = {
  "23505": [409, "A record with this value already exists"],
  "23503": [409, "A related record does not exist, or this record is still in use"],
  "23502": [400, "A required field is missing"],
  "23514": [400, "A value breaks a database rule"],
  "22P02": [400, "A value has an invalid format"],
  "22007": [400, "Invalid date or time"],
  "22008": [400, "Date or time out of range"],
  "22001": [400, "A value is too long"],
};

// Friendly messages for named constraints
const FRIENDLY: Record<string, string> = {
  uq_users_email: "This email is already registered",
  uq_pets_microchip: "A pet with this microchip number already exists",
  uq_one_active_placement_per_pet: "This pet already has an active foster placement",
  chk_vacc_date_not_future: "Vaccination date cannot be in the future",
  chk_vacc_expiry_after: "Vaccination expiry must be after the vaccination date",
  chk_medical_date_not_future: "Medical record date cannot be in the future",
  chk_pets_weight_positive: "Weight must be greater than zero",
  chk_pets_age_nonneg: "Age cannot be negative",
  chk_pets_energy_range: "Energy level must be between 1 and 5",
  chk_placement_end_after_start: "End date cannot be before the start date",
  chk_users_email_format: "Email address is not valid",
  chk_fp_capacity_min: "Foster capacity must be at least 1",
};

interface PgLikeError {
  code: string;
  message: string;
  constraint?: string;
}

function isPgError(e: unknown): e is PgLikeError {
  return (
    typeof e === "object" &&
    e !== null &&
    typeof (e as { code?: unknown }).code === "string" &&
    typeof (e as { message?: unknown }).message === "string"
  );
}

function json(status: number, error: string, details?: unknown) {
  return NextResponse.json(details === undefined ? { error } : { error, details }, { status });
}

export function toResponse(e: unknown): NextResponse {
  if (e instanceof ApiError) return json(e.status, e.message, e.details);

  if (e instanceof ZodError) {
    return json(
      400,
      "Validation failed",
      e.issues.map((i) => ({ field: i.path.join("."), message: i.message }))
    );
  }

  if (e instanceof SyntaxError) return json(400, "Request body must be valid JSON");

  if (isPgError(e)) {
    const custom = CUSTOM_STATUS[e.code];
    if (custom) return json(custom, e.message, { code: e.code });

    if (e.constraint && FRIENDLY[e.constraint]) {
      const status = STANDARD[e.code]?.[0] ?? 400;
      return json(status, FRIENDLY[e.constraint], { code: e.code, constraint: e.constraint });
    }

    const std = STANDARD[e.code];
    if (std) return json(std[0], std[1], { code: e.code, constraint: e.constraint });
  }

  console.error("Unhandled API error:", e);
  return json(500, "Internal server error");
}
