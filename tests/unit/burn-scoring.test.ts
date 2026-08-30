import { describe, it, expect } from "vitest";
import {
  computeScoring,
  computeParkland,
  ageBandIndex,
  regionPct,
  bedTypeForClass,
  DEFAULT_CLINICAL_RULES,
  type PatientFactors,
  type RegionsInput,
} from "@/lib/burn-scoring";

const noFactors = (over: Partial<PatientFactors> = {}): PatientFactors => ({
  age: 34,
  weightKg: null,
  hoursSinceBurn: null,
  mechanism: "flamme",
  inhalation: false,
  closedSpace: false,
  trauma: false,
  comorbidity: false,
  ...over,
});

const r = (
  frac: number,
  depth: "1" | "2s" | "2p" | "3",
  circ = false,
) => ({ frac, depth, circ });

describe("cas imposés par le GOAL", () => {
  it("adulte 25 % sans signe → réanimation (classe 2)", () => {
    // tronc ant. 13 + fesses 5 + bras D 4 + avant-bras G 3 = 25 %, aucune zone à drapeau
    const regions: RegionsInput = {
      tant: r(1, "2s"),
      butt: r(1, "2s"),
      rua: r(1, "2s"),
      lfa: r(1, "2s"),
    };
    const res = computeScoring(regions, noFactors({ age: 34 }));
    expect(res.scbTotal).toBe(25);
    expect(res.signs).toEqual([]);
    expect(res.orientationClass).toBe(2);
    expect(res.adviceRecommended).toBe(false);
  });

  it("enfant 8 ans 12 % → réanimation (classe 2, avis conseillé)", () => {
    // tranche 5-9 ans : tronc ant. ½ = 6.5 + fesses 5 + cou ¼ = 0.5 → 12 %
    const regions: RegionsInput = {
      tant: r(0.5, "2s"),
      butt: r(1, "2s"),
      neck: r(0.25, "2s"),
    };
    const res = computeScoring(regions, noFactors({ age: 8 }));
    expect(res.scbTotal).toBe(12);
    expect(res.signs).toContain("enfant <10 ans");
    expect(res.orientationClass).toBe(2);
    expect(res.adviceRecommended).toBe(true);
    expect(res.orientationLabel).toContain("avis brûlologue");
  });

  it("adulte 30 % + inhalation → centre des brûlés (classe 3)", () => {
    // tronc ant. 13 + tronc post. 13 + bras D 4 = 30 %
    const regions: RegionsInput = {
      tant: r(1, "2p"),
      tpost: r(1, "2p"),
      rua: r(1, "2s"),
    };
    const res = computeScoring(regions, noFactors({ age: 40, inhalation: true }));
    expect(res.scbTotal).toBe(30);
    expect(res.signs).toContain("inhalation");
    expect(res.orientationClass).toBe(3);
    expect(res.orientationLabel).toBe("Centre des brûlés");
  });

  it("adulte 12 % sans signe → chirurgie (classe 1)", () => {
    // fesses 5 + bras D 4 + avant-bras G 3 = 12 %
    const regions: RegionsInput = {
      butt: r(1, "2s"),
      rua: r(1, "2s"),
      lfa: r(1, "2s"),
    };
    const res = computeScoring(regions, noFactors({ age: 34 }));
    expect(res.scbTotal).toBe(12);
    expect(res.signs).toEqual([]);
    expect(res.orientationClass).toBe(1);
    expect(res.orientationLabel).toBe("Service de chirurgie");
  });

  it("1er degré seul → 0 % SCB (classe 1, pas de drapeau face)", () => {
    const regions: RegionsInput = {
      head: r(1, "1"),
      tant: r(1, "1"),
    };
    const res = computeScoring(regions, noFactors({ age: 34 }));
    expect(res.scbTotal).toBe(0);
    expect(res.scbDeep).toBe(0);
    expect(res.signs).toEqual([]); // face en 1er degré ne compte pas comme signe
    expect(res.orientationClass).toBe(1);
  });
});

describe("tranches d'âge Lund-Browder", () => {
  it("bornes des tranches", () => {
    expect(ageBandIndex(0.5)).toBe(0);
    expect(ageBandIndex(1)).toBe(1);
    expect(ageBandIndex(4.9)).toBe(1);
    expect(ageBandIndex(5)).toBe(2);
    expect(ageBandIndex(10)).toBe(3);
    expect(ageBandIndex(15)).toBe(4);
    expect(ageBandIndex(16)).toBe(5);
    expect(ageBandIndex(null)).toBe(null);
  });

  it("tête : 19 % nourrisson, 7 % adulte ; âge inconnu → adulte", () => {
    expect(regionPct("head", 0.5)).toBe(19);
    expect(regionPct("head", 30)).toBe(7);
    expect(regionPct("head", null)).toBe(7);
    expect(regionPct("rth", 12)).toBe(8.5); // cuisse 10-14 ans
  });
});

describe("signes de gravité ISBI", () => {
  it("zones à drapeau : face, mains, pieds, périnée", () => {
    const res = computeScoring(
      { head: r(0.5, "2s"), rh: r(1, "2p"), lft: r(1, "3"), genit: r(1, "2s") },
      noFactors(),
    );
    expect(res.signs).toContain("face");
    expect(res.signs).toContain("mains");
    expect(res.signs).toContain("pieds");
    expect(res.signs).toContain("périnée/OGE");
  });

  it("espace clos ne compte qu'avec une brûlure de la face", () => {
    const sans = computeScoring({ tant: r(1, "2s") }, noFactors({ closedSpace: true }));
    expect(sans.signs).not.toContain("espace clos + face");
    const avec = computeScoring(
      { head: r(0.25, "2s") },
      noFactors({ closedSpace: true }),
    );
    expect(avec.signs).toContain("espace clos + face");
  });

  it("mécanisme électrique et chimique = signes", () => {
    expect(
      computeScoring({ tant: r(0.25, "2s") }, noFactors({ mechanism: "elec" })).signs,
    ).toContain("électrique");
    expect(
      computeScoring({ tant: r(0.25, "2s") }, noFactors({ mechanism: "chim" })).signs,
    ).toContain("chimique");
  });

  it("circonférentielle nommée", () => {
    const res = computeScoring({ rlg: r(1, "2p", true) }, noFactors());
    expect(res.signs.some((s) => s.startsWith("circonférentielle"))).toBe(true);
    expect(res.signs.join()).toContain("Jambe D");
  });

  it("3e degré ≥ 5 % : seuil sur la valeur brute", () => {
    // jambe D adulte 7 % × ¾ = 5.25 ≥ 5 → signe
    const oui = computeScoring({ rlg: r(0.75, "3") }, noFactors());
    expect(oui.signs).toContain("3e degré ≥ 5 %");
    // bras D 4 % × 1 = 4 < 5 → pas de signe
    const non = computeScoring({ rua: r(1, "3") }, noFactors());
    expect(non.signs).not.toContain("3e degré ≥ 5 %");
  });

  it("âges extrêmes : < 10 ans et > 50 ans", () => {
    expect(computeScoring({ tant: r(0.25, "2s") }, noFactors({ age: 9 })).signs).toContain(
      "enfant <10 ans",
    );
    expect(computeScoring({ tant: r(0.25, "2s") }, noFactors({ age: 51 })).signs).toContain(
      ">50 ans",
    );
    expect(computeScoring({ tant: r(0.25, "2s") }, noFactors({ age: 50 })).signs).toEqual([]);
  });

  it("trauma et comorbidité", () => {
    const res = computeScoring(
      { tant: r(0.25, "2s") },
      noFactors({ trauma: true, comorbidity: true }),
    );
    expect(res.signs).toContain("trauma associé");
    expect(res.signs).toContain("comorbidité");
  });
});

describe("classes d'orientation — seuils exacts", () => {
  it("SCB 20.0 exactement, sans signe → réa", () => {
    // tronc ant. 13 + bras D 4 + avant-bras D 3 = 20
    const res = computeScoring(
      { tant: r(1, "2s"), rua: r(1, "2s"), rfa: r(1, "2s") },
      noFactors(),
    );
    expect(res.scbTotal).toBe(20);
    expect(res.orientationClass).toBe(2);
  });

  it("SCB < 20 avec signe → réa + avis brûlologue conseillé", () => {
    const res = computeScoring({ rh: r(1, "2p") }, noFactors());
    expect(res.orientationClass).toBe(2);
    expect(res.adviceRecommended).toBe(true);
  });

  it("SCB ≥ 20 avec signe → centre", () => {
    const res = computeScoring(
      { tant: r(1, "2p"), tpost: r(1, "2p") },
      noFactors({ inhalation: true }),
    );
    expect(res.scbTotal).toBe(26);
    expect(res.orientationClass).toBe(3);
  });

  it("type de lit selon la classe", () => {
    expect(bedTypeForClass(1)).toBe("ward");
    expect(bedTypeForClass(2)).toBe("icu");
    expect(bedTypeForClass(3)).toBe("burn_center");
  });
});

describe("SCB profond et 3e degré", () => {
  it("2e superficiel compte dans la SCB mais pas dans le profond", () => {
    const res = computeScoring(
      { tant: r(1, "2s"), tpost: r(0.5, "2p"), butt: r(1, "3") },
      noFactors(),
    );
    expect(res.scbTotal).toBe(24.5); // 13 + 6.5 + 5
    expect(res.scbDeep).toBe(11.5); // 6.5 + 5
    expect(res.scbThird).toBe(5); // 5
  });
});

describe("Parkland", () => {
  it("adulte 70 kg, SCB 25 %, délai 2 h", () => {
    const p = computeParkland(25, noFactors({ weightKg: 70, hoursSinceBurn: 2 }));
    expect(p).not.toBeNull();
    expect(p!.totalMl).toBe(7000); // 4 × 70 × 25
    expect(p!.first8hMl).toBe(3500);
    expect(p!.ratePerHourMl).toBe(Math.round(3500 / 6)); // 583
    expect(p!.remainingHours).toBe(6);
    expect(p!.maintenanceChildMlH).toBe(0);
  });

  it("délai inconnu → pas de débit affiché", () => {
    const p = computeParkland(25, noFactors({ weightKg: 70 }));
    expect(p!.ratePerHourMl).toBeNull();
  });

  it("entretien enfant (règle 4-2-1) sous 30 kg", () => {
    expect(computeParkland(15, noFactors({ weightKg: 8 }))!.maintenanceChildMlH).toBe(32);
    expect(computeParkland(15, noFactors({ weightKg: 15 }))!.maintenanceChildMlH).toBe(50);
    expect(computeParkland(15, noFactors({ weightKg: 25 }))!.maintenanceChildMlH).toBe(65);
    expect(computeParkland(15, noFactors({ weightKg: 40 }))!.maintenanceChildMlH).toBe(0);
  });

  it("délai > 8 h → phase H0–H8 dépassée", () => {
    const p = computeParkland(30, noFactors({ weightKg: 70, hoursSinceBurn: 10 }));
    expect(p!.remainingHours).toBe(0);
  });

  it("poids manquant ou SCB nulle → null", () => {
    expect(computeParkland(0, noFactors({ weightKg: 70 }))).toBeNull();
    expect(computeParkland(25, noFactors())).toBeNull();
  });
});

describe("configuration des seuils (rules_config)", () => {
  it("un seuil réa abaissé à 15 % change la classe", () => {
    const regions: RegionsInput = { tant: r(1, "2s"), butt: r(1, "2s") }; // 18 %
    const defaut = computeScoring(regions, noFactors());
    expect(defaut.orientationClass).toBe(1);
    const abaisse = computeScoring(regions, noFactors(), {
      ...DEFAULT_CLINICAL_RULES,
      reaSCB: 15,
    });
    expect(abaisse.orientationClass).toBe(2);
  });
});
