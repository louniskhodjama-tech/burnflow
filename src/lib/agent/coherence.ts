import "server-only";
import { z } from "zod";
import { askLLM, extractJson, loadPrompt } from "@/lib/agent/llm";
import type { RegionsInput, ScoringResult } from "@/lib/burn-scoring";
import { REGIONS } from "@/lib/burn-scoring";
import type { AssessmentPayload } from "@/lib/validation";

const responseSchema = z.object({
  issues: z.array(z.string().min(1).max(300)).max(4),
});

/**
 * Contrôle de cohérence à la validation du triage (GOAL §Agent IA 1).
 * Suggestif, jamais bloquant : toute erreur (pas de clé, timeout, JSON
 * invalide) → liste vide, la validation passe (fail-open).
 */
export async function checkAssessmentCoherence(input: {
  factors: Omit<AssessmentPayload, "regions">;
  regions: RegionsInput;
  scoring: ScoringResult;
}): Promise<string[]> {
  const lesions = Object.entries(input.regions)
    .filter(([, s]) => s.frac > 0)
    .map(([k, s]) => ({
      zone: REGIONS[k]?.name ?? k,
      fraction: s.frac,
      profondeur: s.depth,
      circonferentielle: s.circ,
    }));

  const payload = {
    age_ans: input.factors.age,
    poids_kg: input.factors.weightKg,
    delai_heures: input.factors.hoursSinceBurn,
    mecanisme: input.factors.mechanism,
    inhalation: input.factors.inhalation,
    espace_clos: input.factors.closedSpace,
    trauma: input.factors.trauma,
    comorbidite: input.factors.comorbidity,
    lesions,
    scb_totale_pct: input.scoring.scbTotal,
    scb_profonde_pct: input.scoring.scbDeep,
    scb_3e_degre_pct: input.scoring.scbThird,
    signes_retenus: input.scoring.signs,
    classe_orientation: input.scoring.orientationClass,
  };

  const text = await askLLM({
    system: loadPrompt("coherence"),
    user: JSON.stringify(payload, null, 1),
    maxTokens: 500,
    timeoutMs: 15_000,
  });
  if (!text) return [];

  const parsed = responseSchema.safeParse(extractJson(text));
  if (!parsed.success) return [];
  return parsed.data.issues;
}
