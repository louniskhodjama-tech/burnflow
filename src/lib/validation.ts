import { z } from "zod";
import { REGIONS } from "@/lib/burn-scoring";

export const braceletIdSchema = z
  .string()
  .trim()
  .min(1, "ID bracelet requis")
  .max(40)
  .regex(/^[\p{L}0-9 _.\-\/]+$/u, "Caractères non autorisés");

export const patientFieldsSchema = z.object({
  age: z.number().min(0).max(120).nullable(),
  weightKg: z.number().min(1).max(250).nullable(),
  mechanism: z.enum(["flamme", "contact", "elec", "chim"]),
  hoursSinceBurn: z.number().min(0).max(96).nullable(),
  inhalation: z.boolean(),
  closedSpace: z.boolean(),
  trauma: z.boolean(),
  comorbidity: z.boolean(),
});

export const newPatientSchema = patientFieldsSchema.extend({
  siteId: z.string().uuid(),
  braceletId: braceletIdSchema,
});

const REGION_KEYS = Object.keys(REGIONS) as [string, ...string[]];

export const regionStateSchema = z.object({
  frac: z.union([
    z.literal(0),
    z.literal(0.25),
    z.literal(0.5),
    z.literal(0.75),
    z.literal(1),
  ]),
  depth: z.enum(["1", "2s", "2p", "3"]).nullable(),
  circ: z.boolean(),
});

export const regionsSchema = z
  .record(z.enum(REGION_KEYS), regionStateSchema)
  .refine(
    (r) => Object.values(r).every((s) => s.frac === 0 || s.depth !== null),
    "Chaque zone atteinte doit avoir une profondeur",
  );

export const assessmentPayloadSchema = patientFieldsSchema.extend({
  regions: regionsSchema,
});

export type AssessmentPayload = z.infer<typeof assessmentPayloadSchema>;
