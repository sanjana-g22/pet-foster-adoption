import { z } from "zod";

export const SPECIES = ["dog", "cat", "rabbit", "other"] as const;
export const SIZES = ["small", "medium", "large"] as const;
export const SEX = ["male", "female", "unknown"] as const;
export const STATUSES = ["intake", "medical_hold", "available", "in_foster", "adoption_pending", "adopted", "follow_up", "closed", "returned"] as const;
export const MEDICAL_TYPES = ["checkup", "treatment", "surgery", "injury", "behaviour", "other"] as const;
export const END_REASONS = ["adopted", "returned_to_shelter", "medical", "foster_request", "other"] as const;

// optional text: blank / missing becomes null
const text = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a valid date (YYYY-MM-DD)");

export const petSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(60),
  species: z.enum(SPECIES),
  breed: text(60),
  sex: z.enum(SEX),
  ageMonths: z.number().int("Age must be a whole number of months").min(0).max(360),
  size: z.enum(SIZES),
  weightKg: z.number().positive("Weight must be greater than zero").max(200),
  microchipNo: text(30),
  intakeSource: text(60),
  temperament: text(200),
  description: text(2000),
  goodWithKids: z.boolean().default(false),
  goodWithPets: z.boolean().default(false),
  apartmentFriendly: z.boolean().default(false),
  houseTrained: z.boolean().default(false),
  energyLevel: z.number().int().min(1).max(5),
  specialNeeds: text(300),
  photoUrl: text(500),
});
export type PetInput = z.infer<typeof petSchema>;

export const statusSchema = z.object({ to: z.enum(STATUSES), note: text(200) });
export const returnSchema = z.object({ reason: z.string().trim().min(3, "Please give a reason").max(200) });

export const medicalSchema = z.object({
  recordType: z.enum(MEDICAL_TYPES),
  recordDate: date.optional(),
  vetName: text(80),
  diagnosis: text(300),
  treatment: text(300),
  notes: text(1000),
});

export const vaccinationSchema = z.object({
  vaccineName: z.string().trim().min(2).max(60),
  vaccinatedOn: date,
  expiresOn: date.optional(),
  administeredBy: text(80),
});

export const approveSchema = z.object({ approved: z.boolean() });
export const placeSchema = z.object({ petId: z.number().int().positive(), fosterId: z.number().int().positive(), expectedEnd: date.optional() });
export const endSchema = z.object({ reason: z.enum(END_REASONS) });
export const fosterUpdateSchema = z.object({
  updateDate: date.optional(),
  weightKg: z.number().positive().max(200).optional(),
  behaviourNote: text(500),
  healthNote: text(500),
});