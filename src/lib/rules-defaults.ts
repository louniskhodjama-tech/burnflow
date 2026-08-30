import type { RulesJson } from "@/db/schema";

/** Valeurs initiales : identiques au bloc CONFIG du prototype + paramètres de routage du GOAL. */
export const DEFAULT_RULES: RulesJson = {
  reaSCB: 20,
  childBelow: 10,
  elderlyAbove: 50,
  thirdDegreeSign: 5,
  parklandMlKgPct: 4,
  routing: {
    lambda: 1.5,
    saturationThreshold: 0.85,
    cascadeMax: 6,
    timeoutMinutes: 10,
    protectedCenters: true,
    capacityStaleHours: 6,
    adviceReleaseMinutes: 15,
  },
};
