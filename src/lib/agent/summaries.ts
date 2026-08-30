import "server-only";
import { z } from "zod";
import { askLLM, extractJson, loadPrompt } from "@/lib/agent/llm";
import { REGIONS } from "@/lib/burn-scoring";
import type { AssessmentRow, PatientRow } from "@/lib/patients";

const summarySchema = z.object({ summary: z.string().min(10).max(4000) });

function clinicalPayload(patient: PatientRow, assessment: AssessmentRow) {
  const lesions = Object.entries(assessment.regions ?? {})
    .filter(([, s]) => s.frac > 0)
    .map(([k, s]) => ({
      zone: REGIONS[k]?.name ?? k,
      fraction: s.frac,
      profondeur: s.depth,
      circonferentielle: s.circ,
    }));
  return {
    bracelet: patient.braceletId,
    age_ans: patient.age != null ? Number(patient.age) : null,
    poids_kg: patient.weightKg != null ? Number(patient.weightKg) : null,
    mecanisme: patient.mechanism,
    brulure_le: patient.burnedAt?.toISOString() ?? null,
    inhalation: patient.inhalation,
    espace_clos: patient.closedSpace,
    trauma: patient.trauma,
    comorbidite: patient.comorbidity,
    scb_totale_pct: Number(assessment.scbTotal),
    scb_profonde_pct: Number(assessment.scbDeep),
    scb_3e_pct: Number(assessment.scbThird),
    lesions,
    signes: assessment.signs,
    classe: assessment.orientationClass,
    parkland: assessment.parkland?.text ?? null,
  };
}

/** Fiche de transfert rédigée (GOAL §Agent IA 2) — null si échec (fail-open). */
export async function generateTransferSummary(
  patient: PatientRow,
  assessment: AssessmentRow,
): Promise<string | null> {
  const text = await askLLM({
    system: loadPrompt("transfer-summary"),
    user: JSON.stringify(clinicalPayload(patient, assessment), null, 1),
    maxTokens: 700,
    timeoutMs: 20_000,
  });
  if (!text) return null;
  const parsed = summarySchema.safeParse(extractJson(text));
  return parsed.success ? parsed.data.summary : null;
}

/** Synthèse pour avis brûlologue (GOAL §Agent IA 3) — null si échec. */
export async function generateAdviceSummary(
  question: string,
  patient: PatientRow,
  assessment: AssessmentRow | null,
): Promise<string | null> {
  const payload = {
    question_urgentiste: question,
    contexte: assessment ? clinicalPayload(patient, assessment) : { bracelet: patient.braceletId },
  };
  const text = await askLLM({
    system: loadPrompt("advice-summary"),
    user: JSON.stringify(payload, null, 1),
    maxTokens: 600,
    timeoutMs: 20_000,
  });
  if (!text) return null;
  const parsed = summarySchema.safeParse(extractJson(text));
  return parsed.success ? parsed.data.summary : null;
}
