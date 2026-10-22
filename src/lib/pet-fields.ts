// Form field definitions for the pet form (serialisable, so server pages can pass them to the client form)
import type { Field } from "@/components/Form";

export const PET_FIELDS: Field[] = [
  { name: "name", label: "Name", required: true },
  { name: "species", label: "Species", type: "select", options: ["dog", "cat", "rabbit", "other"], required: true },
  { name: "breed", label: "Breed" },
  { name: "sex", label: "Sex", type: "select", options: ["male", "female", "unknown"], required: true },
  { name: "ageMonths", label: "Age (months)", type: "number", required: true, min: 0 },
  { name: "size", label: "Size", type: "select", options: ["small", "medium", "large"], required: true },
  { name: "weightKg", label: "Weight (kg)", type: "number", step: "0.01", required: true, min: 0 },
  { name: "microchipNo", label: "Microchip number" },
  { name: "intakeSource", label: "Intake source" },
  { name: "energyLevel", label: "Energy level (1-5)", type: "number", required: true, min: 1, max: 5 },
  { name: "temperament", label: "Temperament (comma separated)", wide: true },
  { name: "description", label: "Description (used by search)", type: "textarea" },
  { name: "specialNeeds", label: "Special needs", wide: true },
  { name: "photoUrl", label: "Photo URL (optional)", wide: true },
  { name: "goodWithKids", label: "Good with kids", type: "checkbox" },
  { name: "goodWithPets", label: "Good with other pets", type: "checkbox" },
  { name: "apartmentFriendly", label: "Apartment friendly", type: "checkbox" },
  { name: "houseTrained", label: "House trained", type: "checkbox" },
];

export const PET_DEFAULTS = { sex: "unknown", species: "dog", size: "medium", energyLevel: 3 };