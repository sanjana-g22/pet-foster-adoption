import { z } from "zod";
import { petSchema } from "./pets";
const link = z.string().trim().max(500).refine(v => !v || /^https?:\/\//i.test(v), "Use an http or https link").default("");
export const intakeSchema = petSchema.extend({
 photoUrl: link,
 foundLocation: z.string().trim().min(1).max(300),
 foundDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(v => !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0,10) === v && v <= new Date().toISOString().slice(0,10), "Enter a valid date that is not in the future"),
 temporarilyCaring: z.boolean(),
 healthNotes: z.string().trim().min(1).max(2000),
 vaccineNotes: z.string().trim().min(1).max(2000),
 recordUrl: link,
});
export const intakeReviewSchema = z.object({ decision: z.enum(["approved","rejected","needs_information"]), note: z.string().trim().min(3).max(2000) });
