/**
 * Port fidèle de la logique clinique du prototype validé
 * `docs/triage-brulures-v3.html` (Dr Lounis Khodja).
 * Module pur : aucune dépendance UI ni base de données.
 *
 * Toute modification des seuils passe par `rules_config` (versionnée) —
 * les valeurs par défaut ci-dessous sont identiques au bloc CONFIG du prototype.
 */

export type Depth = "1" | "2s" | "2p" | "3";

export type RegionInput = {
  frac: number; // 0 | 0.25 | 0.5 | 0.75 | 1
  depth: Depth | null;
  circ: boolean;
};

export type RegionsInput = Record<string, RegionInput>;

export type Mechanism = "flamme" | "contact" | "elec" | "chim";

export type PatientFactors = {
  age: number | null;
  weightKg: number | null;
  hoursSinceBurn: number | null;
  mechanism: Mechanism;
  inhalation: boolean;
  closedSpace: boolean;
  trauma: boolean;
  comorbidity: boolean;
};

export type ClinicalRules = {
  reaSCB: number; // SCB ≥ x % sans signe → réa
  childBelow: number; // ISBI : âge < x ans = signe
  elderlyAbove: number; // ISBI : âge > x ans = signe
  thirdDegreeSign: number; // 3e degré ≥ x % = signe
  parklandMlKgPct: number;
};

export const DEFAULT_CLINICAL_RULES: ClinicalRules = {
  reaSCB: 20,
  childBelow: 10,
  elderlyAbove: 50,
  thirdDegreeSign: 5,
  parklandMlKgPct: 4,
};

/* ---- Tranches d'âge Lund-Browder ---- */

export const BANDS = [
  { max: 1, label: "0–1 an" },
  { max: 5, label: "1–4 ans" },
  { max: 10, label: "5–9 ans" },
  { max: 15, label: "10–14 ans" },
  { max: 16, label: "15 ans" },
  { max: 999, label: "adulte" },
] as const;

/** Index de tranche d'âge ; null si âge inconnu (les % adultes sont alors utilisés). */
export function ageBandIndex(age: number | null): number | null {
  if (age == null || Number.isNaN(age)) return null;
  return Math.max(
    0,
    BANDS.findIndex((b) => age < b.max),
  );
}

/* ---- Table Lund-Browder (% par tranche 0-1 | 1-4 | 5-9 | 10-14 | 15 | adulte) ---- */

export type RegionDef = {
  name: string;
  pct: readonly [number, number, number, number, number, number];
  flag?: "face" | "mains" | "pieds" | "genit";
  circ?: boolean;
};

export const REGIONS: Record<string, RegionDef> = {
  head: { name: "Tête", pct: [19, 17, 13, 11, 9, 7], flag: "face" },
  neck: { name: "Cou", pct: [2, 2, 2, 2, 2, 2], circ: true },
  tant: { name: "Tronc antérieur", pct: [13, 13, 13, 13, 13, 13], circ: true },
  tpost: { name: "Tronc postérieur", pct: [13, 13, 13, 13, 13, 13], circ: true },
  butt: { name: "Fesses", pct: [5, 5, 5, 5, 5, 5] },
  genit: { name: "Périnée / OGE", pct: [1, 1, 1, 1, 1, 1], flag: "genit" },
  rua: { name: "Bras D", pct: [4, 4, 4, 4, 4, 4], circ: true },
  rfa: { name: "Avant-bras D", pct: [3, 3, 3, 3, 3, 3], circ: true },
  rh: { name: "Main D", pct: [2.5, 2.5, 2.5, 2.5, 2.5, 2.5], flag: "mains" },
  lua: { name: "Bras G", pct: [4, 4, 4, 4, 4, 4], circ: true },
  lfa: { name: "Avant-bras G", pct: [3, 3, 3, 3, 3, 3], circ: true },
  lh: { name: "Main G", pct: [2.5, 2.5, 2.5, 2.5, 2.5, 2.5], flag: "mains" },
  rth: { name: "Cuisse D", pct: [5.5, 6.5, 8, 8.5, 9, 9.5], circ: true },
  rlg: { name: "Jambe D", pct: [5, 5, 5.5, 6, 6.5, 7], circ: true },
  rft: { name: "Pied D", pct: [3.5, 3.5, 3.5, 3.5, 3.5, 3.5], flag: "pieds" },
  lth: { name: "Cuisse G", pct: [5.5, 6.5, 8, 8.5, 9, 9.5], circ: true },
  llg: { name: "Jambe G", pct: [5, 5, 5.5, 6, 6.5, 7], circ: true },
  lft: { name: "Pied G", pct: [3.5, 3.5, 3.5, 3.5, 3.5, 3.5], flag: "pieds" },
};

export const FRACTIONS = [
  { v: 0, l: "—" },
  { v: 0.25, l: "¼" },
  { v: 0.5, l: "½" },
  { v: 0.75, l: "¾" },
  { v: 1, l: "Tout" },
] as const;

export const DEPTHS = [
  { v: "1", l: "1er" },
  { v: "2s", l: "2e sup" },
  { v: "2p", l: "2e prof" },
  { v: "3", l: "3e" },
] as const;

/** % de surface d'une zone pour un âge donné (adulte si âge inconnu). */
export function regionPct(regionKey: string, age: number | null): number {
  const def = REGIONS[regionKey];
  if (!def) return 0;
  const bi = ageBandIndex(age);
  return def.pct[bi == null ? 5 : bi] ?? 0;
}

/* ---- Résultat ---- */

export type Parkland = {
  totalMl: number;
  first8hMl: number;
  ratePerHourMl: number | null; // null si délai inconnu
  remainingHours: number | null;
  maintenanceChildMlH: number; // 0 si non applicable
  text: string;
};

export type OrientationClass = 1 | 2 | 3;

export const ORIENTATION_LABELS: Record<OrientationClass, string> = {
  1: "Service de chirurgie",
  2: "Réanimation",
  3: "Centre des brûlés",
};

export type ScoringResult = {
  scbTotal: number;
  scbDeep: number;
  scbThird: number;
  ageBand: number | null;
  ageBandLabel: string;
  signs: string[];
  why: string[];
  orientationClass: OrientationClass;
  orientationLabel: string;
  adviceRecommended: boolean; // « avis brûlologue conseillé » (signe présent, SCB < seuil)
  parkland: Parkland | null;
};

const round1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Calcul complet : SCB, signes de gravité ISBI, classe d'orientation, Parkland.
 * Réplique exacte de `compute()` du prototype.
 */
export function computeScoring(
  regions: RegionsInput,
  factors: PatientFactors,
  rules: ClinicalRules = DEFAULT_CLINICAL_RULES,
): ScoringResult {
  const age = factors.age;
  const bi = ageBandIndex(age);

  let scb = 0;
  let deep = 0;
  let third = 0;
  const flags = new Set<string>();
  const circumferential: string[] = [];

  for (const id of Object.keys(REGIONS)) {
    const def = REGIONS[id];
    if (!def) continue;
    const s = regions[id];
    if (!s || s.frac <= 0 || !s.depth || s.depth === "1") continue; // 1er degré exclu de la SCB
    const area = (def.pct[bi == null ? 5 : bi] ?? 0) * s.frac;
    scb += area;
    if (s.depth === "2p" || s.depth === "3") deep += area;
    if (s.depth === "3") third += area;
    if (def.flag) flags.add(def.flag);
    if (s.circ) circumferential.push(def.name);
  }

  scb = round1(scb);
  deep = round1(deep);

  // Signes de gravité — même ordre que le prototype
  const signs: string[] = [];
  if (flags.has("face")) signs.push("face");
  if (flags.has("mains")) signs.push("mains");
  if (flags.has("pieds")) signs.push("pieds");
  if (flags.has("genit")) signs.push("périnée/OGE");
  if (factors.inhalation) signs.push("inhalation");
  if (factors.closedSpace && flags.has("face")) signs.push("espace clos + face");
  if (factors.mechanism === "elec") signs.push("électrique");
  if (factors.mechanism === "chim") signs.push("chimique");
  if (circumferential.length)
    signs.push("circonférentielle : " + circumferential.join(", "));
  if (third >= rules.thirdDegreeSign)
    signs.push(`3e degré ≥ ${rules.thirdDegreeSign} %`);
  if (age != null && !Number.isNaN(age) && age < rules.childBelow)
    signs.push("enfant <" + rules.childBelow + " ans");
  if (age != null && !Number.isNaN(age) && age > rules.elderlyAbove)
    signs.push(">" + rules.elderlyAbove + " ans");
  if (factors.trauma) signs.push("trauma associé");
  if (factors.comorbidity) signs.push("comorbidité");

  const big = scb >= rules.reaSCB;
  const grave = signs.length > 0;
  let k = 0;
  if (big && grave) k = 2;
  else if (big || grave) k = 1;

  const why: string[] = [];
  if (big) why.push(`SCB ${scb} % ≥ ${rules.reaSCB} %`);
  why.push(...signs);

  const orientationClass = (k + 1) as OrientationClass;
  const adviceRecommended = grave && !big;

  return {
    scbTotal: scb,
    scbDeep: deep,
    scbThird: round1(third),
    ageBand: bi,
    ageBandLabel: bi == null ? "âge ?" : (BANDS[bi]?.label ?? "adulte"),
    signs,
    why,
    orientationClass,
    orientationLabel:
      orientationClass === 2 && adviceRecommended
        ? "Réanimation · avis brûlologue"
        : ORIENTATION_LABELS[orientationClass],
    adviceRecommended,
    parkland: computeParkland(scb, factors, rules),
  };
}

/** Parkland — réplique exacte du prototype (poids requis, SCB > 0). */
export function computeParkland(
  scbRounded: number,
  factors: PatientFactors,
  rules: ClinicalRules = DEFAULT_CLINICAL_RULES,
): Parkland | null {
  const w = factors.weightKg;
  const h = factors.hoursSinceBurn;
  if (w == null || Number.isNaN(w) || scbRounded <= 0) return null;

  const totalMl = Math.round(rules.parklandMlKgPct * w * scbRounded);
  const first8hMl = Math.round(totalMl / 2);
  const hourKnown = h != null && !Number.isNaN(h);
  const elapsed = hourKnown ? Math.min(h, 8) : 0;
  const remainingHours = Math.max(8 - elapsed, 0);
  const rate = Math.round(first8hMl / Math.max(8 - elapsed, 1));

  let maintenanceChildMlH = 0;
  if (w < 30) {
    maintenanceChildMlH = Math.round(
      w <= 10 ? 4 * w : w <= 20 ? 40 + 2 * (w - 10) : 60 + (w - 20),
    );
  }

  let text = `Parkland ${totalMl} ml/24 h · ${first8hMl} ml sur H0–H8`;
  if (hourKnown)
    text += ` → ≈ ${rate} ml/h pour les ${remainingHours.toFixed(1)} h restantes`;
  if (maintenanceChildMlH)
    text += ` · + entretien enfant ≈ ${maintenanceChildMlH} ml/h`;
  text += " · diurèse cible 0,5 ml/kg/h (1 ml/kg/h enfant)";

  return {
    totalMl,
    first8hMl,
    ratePerHourMl: hourKnown ? rate : null,
    remainingHours: hourKnown ? remainingHours : null,
    maintenanceChildMlH,
    text,
  };
}

/** Type de lit requis selon la classe d'orientation. */
export function bedTypeForClass(
  orientationClass: OrientationClass,
): "ward" | "icu" | "burn_center" {
  return orientationClass === 1
    ? "ward"
    : orientationClass === 2
      ? "icu"
      : "burn_center";
}
