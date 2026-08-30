/**
 * Moteur de routage de proche en proche avec équilibrage (GOAL §Routage).
 * Module PUR : aucune dépendance base ou réseau — testé unitairement.
 */

import type { CascadeEntry } from "@/db/schema";

export type RoutingRules = {
  lambda: number; // pondération de l'occupation
  saturationThreshold: number; // occupation ≥ x → fin de cascade
  cascadeMax: number;
  protectedCenters: boolean;
};

export type CandidateInput = {
  siteId: string;
  siteName: string;
  kind: "hospital" | "burn_center";
  minutes: number;
  km: number;
  distanceSource: "osrm" | "estimate";
  /** Lits libres du type demandé (déjà filtré > 0 par l'appelant ou ici). */
  freeForType: number;
  /** Total déclaré du service (optionnel, snapshot). */
  declaredTotal: number | null;
  /** Max de lits libres déclarés sur les dernières 24 h (approximation D-005). */
  recentMaxFree: number;
};

/**
 * Occupation estimée ∈ [0,1] (GOAL §Routage 2, DECISIONS D-005) :
 * total déclaré si disponible, sinon max(libres récents, libres courants, 1).
 */
export function occupancyOf(c: {
  freeForType: number;
  declaredTotal: number | null;
  recentMaxFree: number;
}): number {
  const total =
    c.declaredTotal != null && c.declaredTotal > 0
      ? c.declaredTotal
      : Math.max(c.recentMaxFree, c.freeForType, 1);
  const occ = 1 - c.freeForType / total;
  return Math.min(1, Math.max(0, occ));
}

/** Score : minutes × (1 + λ × occupation²) — plus bas = mieux (GOAL §Routage 3). */
export function scoreOf(minutes: number, occupancy: number, lambda: number): number {
  return minutes * (1 + lambda * occupancy * occupancy);
}

export type CascadeResult = {
  cascade: CascadeEntry[];
  /** Classe 3 sans centre disponible → orienté réa, le régulateur doit être alerté. */
  fallbackClass3: boolean;
  /** Classe 2 sans réa d'hôpital → centres en dernier recours (mode protégé). */
  fallbackClass2Center: boolean;
};

/**
 * Construit la cascade figée (max `cascadeMax` hôpitaux) pour une demande.
 *
 * Règles :
 * 1. candidats = fournis par l'appelant (actifs, capacité fraîche) avec lits > 0 ;
 * 2. éligibilité par classe et mode centre protégé (GOAL §Routage 5, §Scoring) ;
 * 3. tri par score croissant ;
 * 4. saturés (occ ≥ seuil) déplacés en fin, sauf s'ils sont seuls (GOAL §Routage 4).
 */
export function buildCascade(opts: {
  candidates: CandidateInput[];
  orientationClass: 1 | 2 | 3;
  rules: RoutingRules;
}): CascadeResult {
  const { candidates, orientationClass, rules } = opts;
  const withBeds = candidates.filter((c) => c.freeForType > 0);
  const hospitals = withBeds.filter((c) => c.kind === "hospital");
  const centers = withBeds.filter((c) => c.kind === "burn_center");

  let pool: CandidateInput[] = [];
  let fallbackClass3 = false;
  let fallbackClass2Center = false;

  if (orientationClass === 1) {
    // Chirurgie : jamais un centre des brûlés.
    pool = hospitals;
  } else if (orientationClass === 2) {
    if (!rules.protectedCenters) {
      pool = withBeds;
    } else if (hospitals.length > 0) {
      pool = hospitals;
    } else {
      // Dernier recours : centres (mode protégé, GOAL §Routage 5).
      pool = centers;
      fallbackClass2Center = centers.length > 0;
    }
  } else {
    if (centers.length > 0) {
      pool = centers;
    } else {
      // Aucun centre avec place → réa d'hôpital, régulateur alerté (GOAL §Scoring).
      pool = hospitals;
      fallbackClass3 = hospitals.length > 0;
    }
  }

  const scored = pool.map((c) => {
    const occupancy = occupancyOf(c);
    return {
      candidate: c,
      occupancy,
      score: scoreOf(c.minutes, occupancy, rules.lambda),
    };
  });

  scored.sort((a, b) => a.score - b.score);

  const fresh = scored.filter((s) => s.occupancy < rules.saturationThreshold);
  const saturated = scored.filter((s) => s.occupancy >= rules.saturationThreshold);
  // Saturés en fin de cascade, sauf si seuls candidats (l'ordre relatif est conservé).
  const ordered = fresh.length > 0 ? [...fresh, ...saturated] : saturated;

  const cascade: CascadeEntry[] = ordered.slice(0, rules.cascadeMax).map((s) => ({
    siteId: s.candidate.siteId,
    siteName: s.candidate.siteName,
    minutes: s.candidate.minutes,
    km: s.candidate.km,
    occupancy: Math.round(s.occupancy * 100) / 100,
    score: Math.round(s.score * 10) / 10,
    distanceSource: s.candidate.distanceSource,
  }));

  return { cascade, fallbackClass3, fallbackClass2Center };
}

/** Type de lit demandé pour une classe, avec repli éventuel décidé par buildCascade. */
export function bedTypeForCascade(
  orientationClass: 1 | 2 | 3,
  result: CascadeResult,
): "ward" | "icu" | "burn_center" {
  if (orientationClass === 1) return "ward";
  if (orientationClass === 2)
    return result.fallbackClass2Center ? "burn_center" : "icu";
  return result.fallbackClass3 ? "icu" : "burn_center";
}
