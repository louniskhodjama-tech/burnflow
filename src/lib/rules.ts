import "server-only";
import { desc } from "drizzle-orm";
import { db } from "@/db";
import { rulesConfig, type RulesJson } from "@/db/schema";

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

export async function getCurrentRules(): Promise<{
  version: number;
  config: RulesJson;
}> {
  const row = (
    await db
      .select()
      .from(rulesConfig)
      .orderBy(desc(rulesConfig.version))
      .limit(1)
  )[0];
  if (row) {
    // Tolérance aux versions antérieures du schéma de config : complète les manquants.
    const config: RulesJson = {
      ...DEFAULT_RULES,
      ...row.config,
      routing: { ...DEFAULT_RULES.routing, ...(row.config?.routing ?? {}) },
    };
    return { version: row.version, config };
  }
  const inserted = await db
    .insert(rulesConfig)
    .values({ config: DEFAULT_RULES, comment: "Valeurs initiales (prototype validé)" })
    .returning();
  const first = inserted[0];
  if (!first) throw new Error("rules_config: insertion initiale impossible");
  return { version: first.version, config: first.config };
}
