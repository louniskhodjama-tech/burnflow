/**
 * Fiche de transfert déterministe (texte brut) — reprise de `fiche()` du
 * prototype. Sert de secours quand la fiche rédigée par l'agent n'est pas
 * disponible, et de pied de page factuel dans la version imprimable.
 */

import {
  DEPTHS,
  FRACTIONS,
  ORIENTATION_LABELS,
  REGIONS,
} from "@/lib/burn-scoring";
import type { RegionsJson } from "@/db/schema";

export function buildDeterministicFiche(input: {
  braceletId: string;
  age: number | null;
  weightKg: number | null;
  hoursSinceBurn: number | null;
  regions: RegionsJson;
  scbTotal: number;
  scbDeep: number;
  scbThird: number;
  orientationClass: 1 | 2 | 3;
  why: string[];
  parklandText: string | null;
}): string {
  const lesions =
    Object.entries(input.regions)
      .filter(([, s]) => s.frac > 0)
      .map(([k, s]) => {
        const name = REGIONS[k]?.name ?? k;
        const frac = FRACTIONS.find((f) => f.v === s.frac)?.l ?? s.frac;
        const depth = DEPTHS.find((d) => d.v === s.depth)?.l ?? "?";
        return `- ${name} : ${frac} · ${depth}${s.circ ? " · circonférentielle" : ""}`;
      })
      .join("\n") || "- aucune zone";

  return `FICHE DE TRANSFERT — BRÛLÉ
ID bracelet : ${input.braceletId}   Âge : ${input.age ?? "—"} ans   Poids est. : ${input.weightKg ?? "—"} kg   Délai : ${input.hoursSinceBurn ?? "—"} h
SCB (2e+) : ${input.scbTotal} %   dont profond : ${input.scbDeep} %   3e degré : ${input.scbThird} %
Orientation : ${ORIENTATION_LABELS[input.orientationClass].toUpperCase()}
Critères : ${input.why.join(" ; ") || "aucun"}
Lésions :
${lesions}
${input.parklandText ?? "Parkland : poids non renseigné."}
${new Date().toLocaleString("fr-DZ")} — proposition à valider par le médecin.`;
}
