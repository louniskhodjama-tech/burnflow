import { describe, it, expect } from "vitest";
import {
  buildCascade,
  occupancyOf,
  scoreOf,
  bedTypeForCascade,
  type CandidateInput,
  type RoutingRules,
} from "@/lib/routing";

const RULES: RoutingRules = {
  lambda: 1.5,
  saturationThreshold: 0.85,
  cascadeMax: 6,
  protectedCenters: true,
};

let n = 0;
const cand = (over: Partial<CandidateInput>): CandidateInput => ({
  siteId: `S${++n}`,
  siteName: over.siteName ?? `Hôpital ${n}`,
  kind: "hospital",
  minutes: 30,
  km: 35,
  distanceSource: "osrm",
  freeForType: 3,
  declaredTotal: 10,
  recentMaxFree: 5,
  ...over,
});

describe("occupation estimée (D-005)", () => {
  it("avec total déclaré : 1 − libres/total", () => {
    expect(occupancyOf({ freeForType: 3, declaredTotal: 10, recentMaxFree: 5 })).toBeCloseTo(0.7);
    expect(occupancyOf({ freeForType: 10, declaredTotal: 10, recentMaxFree: 5 })).toBe(0);
    expect(occupancyOf({ freeForType: 0, declaredTotal: 10, recentMaxFree: 5 })).toBe(1);
  });

  it("sans total : max(libres récents, libres courants, 1)", () => {
    expect(occupancyOf({ freeForType: 2, declaredTotal: null, recentMaxFree: 8 })).toBeCloseTo(0.75);
    // libres courants > max récent → occupation 0
    expect(occupancyOf({ freeForType: 9, declaredTotal: null, recentMaxFree: 4 })).toBe(0);
    // aucun historique : max(0, 1, 1) = 1 → 1 lit libre = service vide
    expect(occupancyOf({ freeForType: 1, declaredTotal: null, recentMaxFree: 0 })).toBe(0);
  });
});

describe("score = minutes × (1 + λ·occ²)", () => {
  it("valeurs de référence", () => {
    expect(scoreOf(30, 0, 1.5)).toBe(30);
    expect(scoreOf(30, 0.7, 1.5)).toBeCloseTo(30 * (1 + 1.5 * 0.49)); // 52.05
    expect(scoreOf(10, 1, 1.5)).toBeCloseTo(25);
  });

  it("un hôpital proche mais saturé peut perdre contre un plus loin et vide", () => {
    const proche = scoreOf(20, 0.9, 1.5); // 44.3
    const loin = scoreOf(40, 0, 1.5); // 40
    expect(loin).toBeLessThan(proche);
  });
});

describe("cascade — éligibilité par classe", () => {
  it("classe 1 : jamais de centre des brûlés", () => {
    const r = buildCascade({
      candidates: [
        cand({ siteId: "H1" }),
        cand({ siteId: "C1", kind: "burn_center" }),
      ],
      orientationClass: 1,
      rules: RULES,
    });
    expect(r.cascade.map((c) => c.siteId)).toEqual(["H1"]);
  });

  it("classe 2 mode protégé : centres exclus tant qu'une réa d'hôpital existe", () => {
    const r = buildCascade({
      candidates: [
        cand({ siteId: "H1", minutes: 60 }),
        cand({ siteId: "C1", kind: "burn_center", minutes: 10 }),
      ],
      orientationClass: 2,
      rules: RULES,
    });
    expect(r.cascade.map((c) => c.siteId)).toEqual(["H1"]);
    expect(r.fallbackClass2Center).toBe(false);
  });

  it("classe 2 : centre en dernier recours si aucune réa d'hôpital", () => {
    const r = buildCascade({
      candidates: [
        cand({ siteId: "H1", freeForType: 0 }),
        cand({ siteId: "C1", kind: "burn_center" }),
      ],
      orientationClass: 2,
      rules: RULES,
    });
    expect(r.cascade.map((c) => c.siteId)).toEqual(["C1"]);
    expect(r.fallbackClass2Center).toBe(true);
    expect(bedTypeForCascade(2, r)).toBe("burn_center");
  });

  it("classe 2 mode protégé désactivé : centres en concurrence normale", () => {
    const r = buildCascade({
      candidates: [
        cand({ siteId: "H1", minutes: 60 }),
        cand({ siteId: "C1", kind: "burn_center", minutes: 10 }),
      ],
      orientationClass: 2,
      rules: { ...RULES, protectedCenters: false },
    });
    expect(r.cascade[0]?.siteId).toBe("C1");
  });

  it("classe 3 : centres d'abord ; sans centre → réa + alerte régulateur", () => {
    const avecCentre = buildCascade({
      candidates: [
        cand({ siteId: "H1", minutes: 5 }),
        cand({ siteId: "C1", kind: "burn_center", minutes: 300 }),
      ],
      orientationClass: 3,
      rules: RULES,
    });
    expect(avecCentre.cascade.map((c) => c.siteId)).toEqual(["C1"]);
    expect(avecCentre.fallbackClass3).toBe(false);

    const sansCentre = buildCascade({
      candidates: [
        cand({ siteId: "H1" }),
        cand({ siteId: "C1", kind: "burn_center", freeForType: 0 }),
      ],
      orientationClass: 3,
      rules: RULES,
    });
    expect(sansCentre.cascade.map((c) => c.siteId)).toEqual(["H1"]);
    expect(sansCentre.fallbackClass3).toBe(true);
    expect(bedTypeForCascade(3, sansCentre)).toBe("icu");
  });
});

describe("cascade — tri, saturation, longueur", () => {
  it("tri par score croissant (distance × charge)", () => {
    const r = buildCascade({
      candidates: [
        cand({ siteId: "LOIN_VIDE", minutes: 40, freeForType: 10, declaredTotal: 10 }), // score 40
        cand({ siteId: "PROCHE_SATURE", minutes: 20, freeForType: 1, declaredTotal: 10 }), // occ .9 sat
        cand({ siteId: "MOYEN", minutes: 30, freeForType: 5, declaredTotal: 10 }), // occ .5 → 41.25
      ],
      orientationClass: 2,
      rules: RULES,
    });
    expect(r.cascade.map((c) => c.siteId)).toEqual(["LOIN_VIDE", "MOYEN", "PROCHE_SATURE"]);
  });

  it("saturé (occ ≥ 0.85) relégué en fin même avec meilleur score", () => {
    const r = buildCascade({
      candidates: [
        cand({ siteId: "SATURE", minutes: 5, freeForType: 1, declaredTotal: 10 }), // score ~11 mais occ .9
        cand({ siteId: "OK", minutes: 60, freeForType: 8, declaredTotal: 10 }), // score ~63.6
      ],
      orientationClass: 2,
      rules: RULES,
    });
    expect(r.cascade.map((c) => c.siteId)).toEqual(["OK", "SATURE"]);
  });

  it("saturé seul candidat : conservé en tête", () => {
    const r = buildCascade({
      candidates: [cand({ siteId: "SATURE", freeForType: 1, declaredTotal: 20 })],
      orientationClass: 2,
      rules: RULES,
    });
    expect(r.cascade.map((c) => c.siteId)).toEqual(["SATURE"]);
  });

  it("cascade limitée à cascadeMax (6)", () => {
    const candidates = Array.from({ length: 9 }, (_, i) =>
      cand({ siteId: `H${i}`, minutes: 10 + i }),
    );
    const r = buildCascade({ candidates, orientationClass: 2, rules: RULES });
    expect(r.cascade).toHaveLength(6);
    expect(r.cascade[0]?.siteId).toBe("H0");
  });

  it("lits à zéro : jamais candidats", () => {
    const r = buildCascade({
      candidates: [cand({ siteId: "VIDE", freeForType: 0 })],
      orientationClass: 2,
      rules: RULES,
    });
    expect(r.cascade).toHaveLength(0);
  });

  it("aucun candidat → cascade vide, pas de crash", () => {
    const r = buildCascade({ candidates: [], orientationClass: 3, rules: RULES });
    expect(r.cascade).toEqual([]);
    expect(r.fallbackClass3).toBe(false);
  });
});
