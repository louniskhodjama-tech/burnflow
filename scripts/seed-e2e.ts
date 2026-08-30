import "./_env";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import {
  capacitySnapshots,
  memberships,
  sites,
  users,
} from "../src/db/schema";

/**
 * Contexte dédié au scénario E2E (tests/e2e/scenario.spec.ts) :
 * un point médical isolé (Sud-Ouest) + 3 hôpitaux proches A/B/C avec
 * un référent chacun, un urgentiste, un brûlologue et un régulateur.
 * L'éloignement géographique garantit que A, B, C ouvrent la cascade.
 * Idempotent.
 */

const E2E_SITES = [
  { kind: "triage_point" as const, name: "PMA E2E", wilaya: "E2E", lat: 30.0, lng: -1.0, phone: "000" },
  { kind: "hospital" as const, name: "Hôpital E2E-A", wilaya: "E2E", lat: 30.05, lng: -1.0, phone: "111" },
  { kind: "hospital" as const, name: "Hôpital E2E-B", wilaya: "E2E", lat: 30.1, lng: -1.0, phone: "222" },
  { kind: "hospital" as const, name: "Hôpital E2E-C", wilaya: "E2E", lat: 30.15, lng: -1.0, phone: "333" },
];

const E2E_USERS = [
  { email: "urg@e2e.local", displayName: "E2E Urgentiste", role: "urgentiste" as const, siteNames: ["PMA E2E"] },
  { email: "refa@e2e.local", displayName: "E2E Référent A", role: "referent" as const, siteNames: ["Hôpital E2E-A"] },
  { email: "refb@e2e.local", displayName: "E2E Référent B", role: "referent" as const, siteNames: ["Hôpital E2E-B"] },
  { email: "refc@e2e.local", displayName: "E2E Référent C", role: "referent" as const, siteNames: ["Hôpital E2E-C"] },
  { email: "bru@e2e.local", displayName: "E2E Brûlologue", role: "brulologue" as const, siteNames: [] },
  { email: "reg@e2e.local", displayName: "E2E Régulateur", role: "regulateur" as const, siteNames: [] },
];

async function main() {
  const siteIds = new Map<string, string>();
  for (const s of E2E_SITES) {
    let row = (
      await db.select().from(sites).where(eq(sites.name, s.name)).limit(1)
    )[0];
    if (!row) {
      row = (
        await db
          .insert(sites)
          .values({ ...s, active: true, toVerify: false })
          .returning()
      )[0]!;
    }
    siteIds.set(s.name, row.id);
  }

  const userIds = new Map<string, string>();
  for (const u of E2E_USERS) {
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
            active: true,
          })
          .returning()
      )[0]!;
    }
    userIds.set(u.email, row.id);
    for (const siteName of u.siteNames) {
      await db
        .insert(memberships)
        .values({ userId: row.id, siteId: siteIds.get(siteName)! })
        .onConflictDoNothing();
    }
  }

  // Capacités fraîches : 2 lits de réa partout (A sera refusé, B expirera, C acceptera).
  const refA = userIds.get("refa@e2e.local")!;
  for (const name of ["Hôpital E2E-A", "Hôpital E2E-B", "Hôpital E2E-C"]) {
    await db.insert(capacitySnapshots).values({
      siteId: siteIds.get(name)!,
      icuBedsFree: 2,
      wardBedsFree: 5,
      orAvailable: true,
      burnSurgeonPresent: false,
      suppliesOk: true,
      declaredTotalIcu: 4,
      declaredTotalWard: 10,
      createdBy: refA,
    });
  }

  console.log("Seed E2E prêt (sites A/B/C + comptes e2e.local, capacités fraîches).");
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
