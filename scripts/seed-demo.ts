import "./_env";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  accessCodes,
  capacitySnapshots,
  memberships,
  sites,
  users,
} from "../src/db/schema";
import { generateAccessCode, sha256 } from "../src/lib/crypto";
import { DEFAULT_RULES } from "../src/lib/rules-defaults";
import { rulesConfig } from "../src/db/schema";

/**
 * Données de démonstration (GOAL §Livrables) :
 * 3 points de triage, 6 hôpitaux, 1 centre des brûlés, 1 utilisateur par rôle.
 * Ré-exécutable : upsert par email (users) et par nom (sites).
 */

type SiteSeed = {
  kind: "triage_point" | "hospital" | "burn_center";
  name: string;
  wilaya: string;
  lat: number;
  lng: number;
  phone: string;
};

const SITES: SiteSeed[] = [
  { kind: "triage_point", name: "PMA Jijel — stade Rouibah Hocine", wilaya: "Jijel", lat: 36.8206, lng: 5.7662, phone: "034 47 11 11" },
  { kind: "triage_point", name: "PMA Béjaïa — maison de la culture", wilaya: "Béjaïa", lat: 36.7509, lng: 5.0567, phone: "034 21 22 22" },
  { kind: "triage_point", name: "PMA Skikda — place du 1er Novembre", wilaya: "Skikda", lat: 36.8791, lng: 6.9075, phone: "038 75 33 33" },
  { kind: "hospital", name: "EPH Jijel Mohamed Seddik Benyahia", wilaya: "Jijel", lat: 36.8145, lng: 5.7532, phone: "034 47 44 44" },
  { kind: "hospital", name: "CHU Béjaïa Khellil Amrane", wilaya: "Béjaïa", lat: 36.7423, lng: 5.0721, phone: "034 21 55 55" },
  { kind: "hospital", name: "EPH Skikda", wilaya: "Skikda", lat: 36.8697, lng: 6.9068, phone: "038 75 66 66" },
  { kind: "hospital", name: "CHU Constantine Benbadis", wilaya: "Constantine", lat: 36.3543, lng: 6.6147, phone: "031 64 77 77" },
  { kind: "hospital", name: "CHU Sétif Saâdna Abdenour", wilaya: "Sétif", lat: 36.1932, lng: 5.4064, phone: "036 84 88 88" },
  { kind: "hospital", name: "CHU Annaba Ibn Rochd", wilaya: "Annaba", lat: 36.8983, lng: 7.7549, phone: "038 86 99 99" },
  { kind: "burn_center", name: "Centre des brûlés de Douéra (Alger)", wilaya: "Alger", lat: 36.6702, lng: 2.9442, phone: "023 91 00 00" },
];

const USERS = [
  { email: "urgentiste@demo.local", displayName: "Dr Amina K. (urgentiste)", role: "urgentiste" as const, isAdmin: false, siteNames: ["PMA Jijel — stade Rouibah Hocine", "PMA Béjaïa — maison de la culture"] },
  { email: "referent@demo.local", displayName: "Dr Salim B. (référent EPH Jijel)", role: "referent" as const, isAdmin: false, siteNames: ["EPH Jijel Mohamed Seddik Benyahia"] },
  { email: "regulateur@demo.local", displayName: "Dr Nadia M. (régulatrice)", role: "regulateur" as const, isAdmin: true, siteNames: [] },
  { email: "brulologue@demo.local", displayName: "Pr Yacine T. (brûlologue)", role: "brulologue" as const, isAdmin: false, siteNames: [] },
];

// Capacités initiales : variété voulue pour la démo de routage.
const CAPACITIES: Record<string, { icu: number; ward: number; or: boolean; surgeon: boolean; supplies: boolean; totalIcu?: number; totalWard?: number }> = {
  "EPH Jijel Mohamed Seddik Benyahia": { icu: 2, ward: 8, or: true, surgeon: false, supplies: true, totalIcu: 6, totalWard: 40 },
  "CHU Béjaïa Khellil Amrane": { icu: 1, ward: 5, or: true, surgeon: true, supplies: true, totalIcu: 10, totalWard: 60 },
  "EPH Skikda": { icu: 0, ward: 12, or: false, surgeon: false, supplies: true, totalIcu: 4, totalWard: 35 },
  "CHU Constantine Benbadis": { icu: 4, ward: 15, or: true, surgeon: true, supplies: true, totalIcu: 12, totalWard: 80 },
  "CHU Sétif Saâdna Abdenour": { icu: 3, ward: 10, or: true, surgeon: false, supplies: true, totalIcu: 8, totalWard: 50 },
  "CHU Annaba Ibn Rochd": { icu: 2, ward: 9, or: true, surgeon: true, supplies: false, totalIcu: 10, totalWard: 55 },
  "Centre des brûlés de Douéra (Alger)": { icu: 1, ward: 2, or: true, surgeon: true, supplies: true, totalIcu: 8, totalWard: 20 },
};

async function main() {
  console.log("— Seed de démonstration —");

  const siteIds = new Map<string, string>();
  for (const s of SITES) {
    const existing = (
      await db.select().from(sites).where(eq(sites.name, s.name)).limit(1)
    )[0];
    if (existing) {
      siteIds.set(s.name, existing.id);
      continue;
    }
    const inserted = await db
      .insert(sites)
      .values({ ...s, active: true, toVerify: false })
      .returning({ id: sites.id });
    siteIds.set(s.name, inserted[0]!.id);
    console.log(`site créé : ${s.name}`);
  }

  const userIds = new Map<string, string>();
  for (const u of USERS) {
    let row = (
      await db.select().from(users).where(eq(users.email, u.email)).limit(1)
    )[0];
    if (!row) {
      row = (
        await db
          .insert(users)
          .values({
            email: u.email,
            displayName: u.displayName,
            role: u.role,
            isAdmin: u.isAdmin,
            active: true,
          })
          .returning()
      )[0]!;
      console.log(`utilisateur créé : ${u.email} (${u.role})`);
    }
    userIds.set(u.email, row.id);
    for (const siteName of u.siteNames) {
      const siteId = siteIds.get(siteName);
      if (!siteId) continue;
      await db
        .insert(memberships)
        .values({ userId: row.id, siteId })
        .onConflictDoNothing();
    }
  }

  // Config des règles (version initiale si absente)
  const existingRules = await db.select().from(rulesConfig).limit(1);
  if (existingRules.length === 0) {
    await db.insert(rulesConfig).values({
      config: DEFAULT_RULES,
      comment: "Valeurs initiales (prototype validé)",
      createdBy: userIds.get("regulateur@demo.local"),
    });
    console.log("rules_config v1 insérée");
  }

  // Capacités
  const referentId = userIds.get("referent@demo.local")!;
  for (const [name, c] of Object.entries(CAPACITIES)) {
    const siteId = siteIds.get(name);
    if (!siteId) continue;
    await db.insert(capacitySnapshots).values({
      siteId,
      icuBedsFree: c.icu,
      wardBedsFree: c.ward,
      orAvailable: c.or,
      burnSurgeonPresent: c.surgeon,
      suppliesOk: c.supplies,
      declaredTotalIcu: c.totalIcu ?? null,
      declaredTotalWard: c.totalWard ?? null,
      createdBy: referentId,
    });
  }
  console.log("capacités initiales enregistrées");

  // Codes d'accès frais (un par utilisateur, 24 h, usage unique)
  console.log("\nCodes d'accès (24 h, usage unique) :");
  const regulateurId = userIds.get("regulateur@demo.local")!;
  for (const u of USERS) {
    const code = generateAccessCode();
    await db.insert(accessCodes).values({
      codeHash: sha256(code),
      userId: userIds.get(u.email)!,
      createdBy: regulateurId,
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    });
    console.log(`  ${u.role.padEnd(12)} ${u.email.padEnd(28)} → ${code.slice(0, 4)}-${code.slice(4)}`);
  }

  console.log("\nSeed terminé.");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
