import "server-only";
import { and, desc, eq, gt, inArray, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  adviceRequests,
  capacitySnapshots,
  memberships,
  sites,
  transferRequests,
  users,
} from "@/db/schema";
import { expireDueTransfers } from "@/lib/transfers";
import { releaseStaleAdvice } from "@/lib/advice";
import { getCurrentRules } from "@/lib/rules";
import { notifyUser, notifyRole } from "@/lib/notify";
import { sendEmail } from "@/lib/email";

/**
 * Jobs périodiques (GOAL §Routage 6 in fine, §Agent IA in fine).
 * Idempotents : chaque exécution repart de l'état en base.
 */

export async function minuteTick(): Promise<void> {
  try {
    const expired = await expireDueTransfers();
    if (expired > 0) console.log(`[jobs] ${expired} demande(s) expirée(s) → bascule`);
  } catch (e) {
    console.error("[jobs] expiration transferts :", e);
  }
  try {
    const released = await releaseStaleAdvice();
    if (released > 0) console.log(`[jobs] ${released} avis revenus en file`);
  } catch (e) {
    console.error("[jobs] relâche avis :", e);
  }
}

/* ------------------ Relance capacités périmées (> 6 h) ------------------ */

const lastCapacityReminder = new Map<string, number>();

export async function remindStaleCapacities(): Promise<void> {
  const { config } = await getCurrentRules();
  const staleMs = config.routing.capacityStaleHours * 3600 * 1000;
  const now = Date.now();

  const latest = db
    .selectDistinctOn([capacitySnapshots.siteId], {
      siteId: capacitySnapshots.siteId,
      createdAt: capacitySnapshots.createdAt,
    })
    .from(capacitySnapshots)
    .orderBy(capacitySnapshots.siteId, desc(capacitySnapshots.createdAt))
    .as("latest");

  const hospitals = await db
    .select({ id: sites.id, name: sites.name, snapAt: latest.createdAt })
    .from(sites)
    .leftJoin(latest, eq(latest.siteId, sites.id))
    .where(and(eq(sites.active, true), inArray(sites.kind, ["hospital", "burn_center"])));

  for (const h of hospitals) {
    const age = h.snapAt ? now - new Date(h.snapAt).getTime() : Infinity;
    if (age <= staleMs) continue;
    // Au plus une relance par site toutes les capacityStaleHours.
    const last = lastCapacityReminder.get(h.id) ?? 0;
    if (now - last < staleMs) continue;
    lastCapacityReminder.set(h.id, now);

    const refs = await db
      .select({ id: users.id })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(
        and(
          eq(memberships.siteId, h.id),
          eq(users.role, "referent"),
          eq(users.active, true),
        ),
      );
    for (const r of refs) {
      await notifyUser(r.id, {
        kind: "capacity.stale",
        title: `Capacité périmée — ${h.name}`,
        body: `Votre capacité n'a pas été mise à jour depuis plus de ${config.routing.capacityStaleHours} h : votre hôpital n'est plus proposé aux transferts. Confirmez ou corrigez.`,
        url: "/hopital",
      });
    }
  }
}

/* ------------------ Rapport de situation (toutes les 6 h) ------------------ */

export async function sendSituationReport(): Promise<void> {
  const { config } = await getCurrentRules();
  const staleCutoff = new Date(Date.now() - config.routing.capacityStaleHours * 3600 * 1000);

  const pendingByClass = await db
    .select({
      klass: transferRequests.orientationClass,
      count: sql<number>`count(*)::int`,
    })
    .from(transferRequests)
    .where(eq(transferRequests.status, "pending"))
    .groupBy(transferRequests.orientationClass);

  const exhausted = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transferRequests)
    .where(and(eq(transferRequests.status, "pending"), eq(transferRequests.exhausted, true)));

  const accepted24h = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transferRequests)
    .where(
      and(
        inArray(transferRequests.status, ["accepted", "forced", "arrived"]),
        gt(transferRequests.createdAt, new Date(Date.now() - 24 * 3600 * 1000)),
      ),
    );

  const latest = db
    .selectDistinctOn([capacitySnapshots.siteId], {
      siteId: capacitySnapshots.siteId,
      icu: capacitySnapshots.icuBedsFree,
      ward: capacitySnapshots.wardBedsFree,
      createdAt: capacitySnapshots.createdAt,
    })
    .from(capacitySnapshots)
    .orderBy(capacitySnapshots.siteId, desc(capacitySnapshots.createdAt))
    .as("latest");

  const capacity = await db
    .select({
      name: sites.name,
      kind: sites.kind,
      icu: latest.icu,
      ward: latest.ward,
      snapAt: latest.createdAt,
    })
    .from(sites)
    .leftJoin(latest, eq(latest.siteId, sites.id))
    .where(and(eq(sites.active, true), inArray(sites.kind, ["hospital", "burn_center"])));

  const openAdvice = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(adviceRequests)
    .where(inArray(adviceRequests.status, ["open", "released", "claimed"]));

  const lines: string[] = [];
  lines.push(`RAPPORT DE SITUATION — ${new Date().toLocaleString("fr-DZ")}`);
  lines.push("");
  lines.push("Demandes de transfert en attente :");
  for (const k of [1, 2, 3]) {
    const c = pendingByClass.find((p) => p.klass === k)?.count ?? 0;
    lines.push(`  classe ${k} : ${c}`);
  }
  lines.push(`  dont cascades épuisées : ${exhausted[0]?.count ?? 0}`);
  lines.push(`Transferts aboutis (24 h) : ${accepted24h[0]?.count ?? 0}`);
  lines.push(`Avis brûlologue ouverts/en cours : ${openAdvice[0]?.count ?? 0}`);
  lines.push("");
  lines.push("Capacités (lits libres réa / hosp., † = périmée) :");
  for (const c of capacity.sort((a, b) => a.name.localeCompare(b.name))) {
    const stale = !c.snapAt || new Date(c.snapAt) < staleCutoff;
    lines.push(
      `  ${c.kind === "burn_center" ? "★" : "·"} ${c.name} : ${c.icu ?? "?"} / ${c.ward ?? "?"}${stale ? " †" : ""}`,
    );
  }
  const report = lines.join("\n");

  const regs = await db
    .select({ email: users.email })
    .from(users)
    .where(and(eq(users.role, "regulateur"), eq(users.active, true)));
  for (const r of regs) {
    if (r.email) {
      await sendEmail({
        to: r.email,
        subject: "[Triage brûlés] Rapport de situation",
        text: report,
      });
    }
  }
  console.log("[jobs] rapport de situation envoyé");
}
