import "server-only";
import { and, desc, eq, gt, inArray, isNotNull, sql } from "drizzle-orm";
import { db, type Tx } from "@/db";
import {
  assessments,
  capacitySnapshots,
  patients,
  sites,
  transferEvents,
  transferRequests,
  type CascadeEntry,
} from "@/db/schema";
import { audit } from "@/lib/audit";
import { getDistances } from "@/lib/distance";
import {
  bedTypeForCascade,
  buildCascade,
  type CandidateInput,
} from "@/lib/routing";
import { getCurrentRules } from "@/lib/rules";
import { notifyRole, notifySiteReferents, notifyUser } from "@/lib/notify";
import { generateTransferSummary } from "@/lib/agent/summaries";
import type { SessionUser } from "@/lib/auth";
import { can } from "@/lib/policy";

export type TransferRow = typeof transferRequests.$inferSelect;

type BedField = "icuBedsFree" | "wardBedsFree";
function bedField(bedType: "ward" | "icu" | "burn_center"): BedField {
  return bedType === "ward" ? "wardBedsFree" : "icuBedsFree";
}

/* ============================ Création ============================ */

export async function createTransfer(
  actor: SessionUser,
  patientId: string,
): Promise<{ ok: true; requestId: string } | { ok: false; error: string }> {
  const patient = (
    await db.select().from(patients).where(eq(patients.id, patientId)).limit(1)
  )[0];
  if (!patient) return { ok: false, error: "Patient introuvable." };
  if (!can.createTransferRequest(actor, patient.siteId))
    return { ok: false, error: "Accès refusé pour ce site." };

  const assessment = (
    await db
      .select()
      .from(assessments)
      .where(eq(assessments.patientId, patientId))
      .orderBy(desc(assessments.version))
      .limit(1)
  )[0];
  if (!assessment)
    return { ok: false, error: "Saisissez d'abord le triage du patient." };

  const existing = (
    await db
      .select({ id: transferRequests.id })
      .from(transferRequests)
      .where(
        and(
          eq(transferRequests.patientId, patientId),
          inArray(transferRequests.status, ["pending", "accepted", "forced"]),
        ),
      )
      .limit(1)
  )[0];
  if (existing)
    return { ok: false, error: "Une demande de transfert est déjà en cours pour ce patient." };

  const { version: rulesVersion, config } = await getCurrentRules();
  const orientationClass = assessment.orientationClass as 1 | 2 | 3;

  // Candidats : hôpitaux/centres actifs avec capacité fraîche.
  const staleCutoff = new Date(
    Date.now() - config.routing.capacityStaleHours * 3600 * 1000,
  );
  const latestSnapshots = db
    .selectDistinctOn([capacitySnapshots.siteId], {
      siteId: capacitySnapshots.siteId,
      icuBedsFree: capacitySnapshots.icuBedsFree,
      wardBedsFree: capacitySnapshots.wardBedsFree,
      declaredTotalIcu: capacitySnapshots.declaredTotalIcu,
      declaredTotalWard: capacitySnapshots.declaredTotalWard,
      createdAt: capacitySnapshots.createdAt,
    })
    .from(capacitySnapshots)
    .orderBy(capacitySnapshots.siteId, desc(capacitySnapshots.createdAt))
    .as("latest");

  const rows = await db
    .select({
      siteId: sites.id,
      siteName: sites.name,
      kind: sites.kind,
      icuFree: latestSnapshots.icuBedsFree,
      wardFree: latestSnapshots.wardBedsFree,
      totalIcu: latestSnapshots.declaredTotalIcu,
      totalWard: latestSnapshots.declaredTotalWard,
      snapAt: latestSnapshots.createdAt,
    })
    .from(sites)
    .innerJoin(latestSnapshots, eq(latestSnapshots.siteId, sites.id))
    .where(
      and(
        eq(sites.active, true),
        inArray(sites.kind, ["hospital", "burn_center"]),
        gt(latestSnapshots.createdAt, staleCutoff),
      ),
    );

  // Max de lits libres sur 24 h (approximation d'occupation, D-005)
  const dayCutoff = new Date(Date.now() - 24 * 3600 * 1000);
  const recent = rows.length
    ? await db
        .select({
          siteId: capacitySnapshots.siteId,
          maxIcu: sql<number>`max(${capacitySnapshots.icuBedsFree})`,
          maxWard: sql<number>`max(${capacitySnapshots.wardBedsFree})`,
        })
        .from(capacitySnapshots)
        .where(
          and(
            inArray(
              capacitySnapshots.siteId,
              rows.map((r) => r.siteId),
            ),
            gt(capacitySnapshots.createdAt, dayCutoff),
          ),
        )
        .groupBy(capacitySnapshots.siteId)
    : [];
  const recentBySite = new Map(recent.map((r) => [r.siteId, r]));

  const distances = await getDistances(
    patient.siteId,
    rows.map((r) => r.siteId),
  );

  const candidates: CandidateInput[] = [];
  for (const r of rows) {
    const d = distances.get(r.siteId);
    if (!d) continue;
    const useWard = r.kind === "hospital" && orientationClass === 1;
    const freeForType = useWard ? r.wardFree : r.icuFree;
    const declaredTotal = useWard ? r.totalWard : r.totalIcu;
    const rec = recentBySite.get(r.siteId);
    const recentMaxFree = useWard ? Number(rec?.maxWard ?? 0) : Number(rec?.maxIcu ?? 0);
    candidates.push({
      siteId: r.siteId,
      siteName: r.siteName,
      kind: r.kind as "hospital" | "burn_center",
      minutes: d.minutes,
      km: d.km,
      distanceSource: d.source,
      freeForType,
      declaredTotal,
      recentMaxFree,
    });
  }

  const result = buildCascade({
    candidates,
    orientationClass,
    rules: {
      lambda: config.routing.lambda,
      saturationThreshold: config.routing.saturationThreshold,
      cascadeMax: config.routing.cascadeMax,
      protectedCenters: config.routing.protectedCenters,
    },
  });
  const bedType = bedTypeForCascade(orientationClass, result);
  const hasCascade = result.cascade.length > 0;

  const requestId = await db.transaction(async (tx) => {
    const inserted = await tx
      .insert(transferRequests)
      .values({
        patientId,
        assessmentId: assessment.id,
        orientationClass,
        bedType,
        cascade: result.cascade,
        currentIndex: 0,
        status: "pending",
        hopSentAt: hasCascade ? new Date() : null,
        timeoutMinutes: config.routing.timeoutMinutes,
        exhausted: !hasCascade,
        rulesVersion,
        createdBy: actor.userId,
      })
      .returning({ id: transferRequests.id });
    const id = inserted[0]!.id;

    await tx.insert(transferEvents).values({
      requestId: id,
      type: "created",
      byUserId: actor.userId,
      meta: {
        orientationClass,
        bedType,
        cascadeSize: result.cascade.length,
        fallbackClass3: result.fallbackClass3,
        fallbackClass2Center: result.fallbackClass2Center,
      },
    });
    if (hasCascade) {
      await tx.insert(transferEvents).values({
        requestId: id,
        type: "sent",
        siteId: result.cascade[0]!.siteId,
      });
    } else {
      await tx.insert(transferEvents).values({
        requestId: id,
        type: "exhausted",
        reason: "Aucun hôpital candidat (capacités épuisées ou périmées).",
      });
    }
    await audit(
      {
        userId: actor.userId,
        role: actor.role,
        action: "transfer.create",
        entityType: "transfer_request",
        entityId: id,
        after: { orientationClass, bedType, cascade: result.cascade.map((c) => c.siteName) },
      },
      tx,
    );
    return id;
  });

  // Fiche de transfert rédigée (agent) — asynchrone, fail-open.
  void generateTransferSummary(patient, assessment)
    .then(async (summary) => {
      if (summary) {
        await db
          .update(transferRequests)
          .set({ summary })
          .where(eq(transferRequests.id, requestId));
      }
    })
    .catch(() => {});

  // Notifications post-transaction.
  const first = result.cascade[0];
  if (first) {
    await notifySiteReferents(first.siteId, {
      kind: "transfer.request",
      title: `Demande de transfert — classe ${orientationClass}`,
      body: `Patient ${patient.braceletId} · SCB ${assessment.scbTotal} % · réponse attendue sous ${config.routing.timeoutMinutes} min.`,
      url: `/hopital/demandes/${requestId}`,
      relatedType: "transfer_request",
      relatedId: requestId,
    });
  } else {
    await notifyRole("regulateur", {
      kind: "transfer.exhausted",
      title: "Aucun hôpital disponible",
      body: `Patient ${patient.braceletId} (classe ${orientationClass}) : aucune destination candidate. Intervention manuelle requise.`,
      url: `/regulation/demandes/${requestId}`,
    });
  }
  if (result.fallbackClass3) {
    await notifyRole("regulateur", {
      kind: "transfer.fallback",
      title: "Classe 3 orientée vers une réanimation",
      body: `Aucun centre des brûlés disponible pour ${patient.braceletId} — cascade sur réanimations. Vérifiez.`,
      url: `/regulation/demandes/${requestId}`,
    });
  }

  return { ok: true, requestId };
}

/* ============================ Acceptation / refus ============================ */

async function loadForUpdate(tx: Tx, requestId: string): Promise<TransferRow | null> {
  const rows = await tx
    .select()
    .from(transferRequests)
    .where(eq(transferRequests.id, requestId))
    .for("update");
  return rows[0] ?? null;
}

/** Verrou consultatif par site : sérialise les réservations d'un même hôpital. */
async function lockSite(tx: Tx, siteId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${siteId}))`);
}

async function reserveBed(
  tx: Tx,
  siteId: string,
  bedType: "ward" | "icu" | "burn_center",
  byUserId: string,
  note: string,
): Promise<boolean> {
  await lockSite(tx, siteId);
  const current = (
    await tx
      .select()
      .from(capacitySnapshots)
      .where(eq(capacitySnapshots.siteId, siteId))
      .orderBy(desc(capacitySnapshots.createdAt))
      .limit(1)
  )[0];
  if (!current) return false;
  const field = bedField(bedType);
  if (current[field] <= 0) return false;
  await tx.insert(capacitySnapshots).values({
    siteId,
    icuBedsFree: current.icuBedsFree - (field === "icuBedsFree" ? 1 : 0),
    wardBedsFree: current.wardBedsFree - (field === "wardBedsFree" ? 1 : 0),
    orAvailable: current.orAvailable,
    burnSurgeonPresent: current.burnSurgeonPresent,
    suppliesOk: current.suppliesOk,
    note,
    declaredTotalIcu: current.declaredTotalIcu,
    declaredTotalWard: current.declaredTotalWard,
    createdBy: byUserId,
  });
  return true;
}

async function releaseBed(
  tx: Tx,
  siteId: string,
  bedType: "ward" | "icu" | "burn_center",
  byUserId: string,
  note: string,
): Promise<void> {
  await lockSite(tx, siteId);
  const current = (
    await tx
      .select()
      .from(capacitySnapshots)
      .where(eq(capacitySnapshots.siteId, siteId))
      .orderBy(desc(capacitySnapshots.createdAt))
      .limit(1)
  )[0];
  if (!current) return;
  const field = bedField(bedType);
  await tx.insert(capacitySnapshots).values({
    siteId,
    icuBedsFree: current.icuBedsFree + (field === "icuBedsFree" ? 1 : 0),
    wardBedsFree: current.wardBedsFree + (field === "wardBedsFree" ? 1 : 0),
    orAvailable: current.orAvailable,
    burnSurgeonPresent: current.burnSurgeonPresent,
    suppliesOk: current.suppliesOk,
    note,
    declaredTotalIcu: current.declaredTotalIcu,
    declaredTotalWard: current.declaredTotalWard,
    createdBy: byUserId,
  });
}

/** La réservation est-elle active (accepté/forcé avec lit décrémenté, non relâché) ? */
async function hasActiveReservation(tx: Tx, requestId: string): Promise<{ siteId: string } | null> {
  const events = await tx
    .select()
    .from(transferEvents)
    .where(eq(transferEvents.requestId, requestId))
    .orderBy(desc(transferEvents.createdAt), desc(transferEvents.id));
  for (const e of events) {
    const meta = (e.meta ?? {}) as { reserved?: boolean; released?: boolean };
    if (meta.released) return null;
    if ((e.type === "accepted" || e.type === "forced") && meta.reserved && e.siteId)
      return { siteId: e.siteId };
  }
  return null;
}

type Advance =
  | { kind: "next"; entry: CascadeEntry }
  | { kind: "exhausted" };

async function advanceCascade(
  tx: Tx,
  req: TransferRow,
  eventType: "declined" | "expired",
  opts: { siteId: string; byUserId?: string; reason?: string },
): Promise<Advance> {
  await tx.insert(transferEvents).values({
    requestId: req.id,
    type: eventType,
    siteId: opts.siteId,
    byUserId: opts.byUserId ?? null,
    reason: opts.reason ?? null,
  });
  const nextIndex = req.currentIndex + 1;
  const next = req.cascade[nextIndex];
  if (next) {
    await tx
      .update(transferRequests)
      .set({ currentIndex: nextIndex, hopSentAt: new Date() })
      .where(eq(transferRequests.id, req.id));
    await tx.insert(transferEvents).values({
      requestId: req.id,
      type: "sent",
      siteId: next.siteId,
    });
    return { kind: "next", entry: next };
  }
  await tx
    .update(transferRequests)
    .set({ hopSentAt: null, exhausted: true })
    .where(eq(transferRequests.id, req.id));
  await tx.insert(transferEvents).values({
    requestId: req.id,
    type: "exhausted",
    reason: "Cascade épuisée sans acceptation.",
  });
  return { kind: "exhausted" };
}

export async function respondTransfer(
  actor: SessionUser,
  requestId: string,
  decision: { accept: true } | { accept: false; reason: string },
): Promise<{ ok: boolean; error?: string }> {
  let notifyAfter: (() => Promise<void>)[] = [];

  const result = await db.transaction(async (tx) => {
    const req = await loadForUpdate(tx, requestId);
    if (!req) return { ok: false as const, error: "Demande introuvable." };
    if (req.status !== "pending" || !req.hopSentAt)
      return { ok: false as const, error: "Cette demande n'est plus en attente." };
    const entry = req.cascade[req.currentIndex];
    if (!entry) return { ok: false as const, error: "Cascade incohérente." };
    if (!can.respondTransfer(actor, entry.siteId))
      return { ok: false as const, error: "Cette demande n'est pas adressée à votre hôpital." };

    const patient = (
      await tx.select().from(patients).where(eq(patients.id, req.patientId)).limit(1)
    )[0]!;

    if (!decision.accept) {
      const reason = decision.reason.trim();
      if (!reason) return { ok: false as const, error: "Le motif de refus est obligatoire." };
      const adv = await advanceCascade(tx, req, "declined", {
        siteId: entry.siteId,
        byUserId: actor.userId,
        reason,
      });
      await audit(
        {
          userId: actor.userId,
          role: actor.role,
          action: "transfer.decline",
          entityType: "transfer_request",
          entityId: req.id,
          after: { reason, hop: entry.siteName },
        },
        tx,
      );
      notifyAfter = buildAdvanceNotifications(adv, req, patient.braceletId);
      return { ok: true as const };
    }

    // Acceptation : réservation du lit sous verrou (un seul gagnant possible).
    const reserved = await reserveBed(
      tx,
      entry.siteId,
      req.bedType,
      actor.userId,
      `Réservation transfert ${patient.braceletId}`,
    );
    if (!reserved)
      return {
        ok: false as const,
        error:
          "Plus de lit disponible de ce type : mettez à jour votre capacité ou refusez la demande.",
      };

    await tx
      .update(transferRequests)
      .set({
        status: "accepted",
        acceptedBySiteId: entry.siteId,
        acceptedAt: new Date(),
        hopSentAt: null,
      })
      .where(eq(transferRequests.id, req.id));
    await tx.insert(transferEvents).values({
      requestId: req.id,
      type: "accepted",
      siteId: entry.siteId,
      byUserId: actor.userId,
      meta: { reserved: true },
    });
    await audit(
      {
        userId: actor.userId,
        role: actor.role,
        action: "transfer.accept",
        entityType: "transfer_request",
        entityId: req.id,
        after: { hop: entry.siteName },
      },
      tx,
    );

    const site = (
      await tx.select().from(sites).where(eq(sites.id, entry.siteId)).limit(1)
    )[0];
    notifyAfter = [
      () =>
        notifyUser(req.createdBy, {
          kind: "transfer.accepted",
          title: `Transfert accepté — ${entry.siteName}`,
          body: `Patient ${patient.braceletId} attendu. Téléphone du service : ${site?.phone ?? "non renseigné"}.`,
          url: `/patients/${req.patientId}/transfert/${req.id}`,
        }),
    ];
    return { ok: true as const };
  });

  for (const n of notifyAfter) await n();
  return result;
}

function buildAdvanceNotifications(
  adv: Advance,
  req: TransferRow,
  braceletId: string,
): (() => Promise<void>)[] {
  if (adv.kind === "next") {
    return [
      () =>
        notifySiteReferents(adv.entry.siteId, {
          kind: "transfer.request",
          title: `Demande de transfert — classe ${req.orientationClass}`,
          body: `Patient ${braceletId} · réponse attendue sous ${req.timeoutMinutes} min.`,
          url: `/hopital/demandes/${req.id}`,
        }),
      () =>
        notifyUser(req.createdBy, {
          kind: "transfer.progress",
          title: "Recherche d'hôpital : étape suivante",
          body: `La demande pour ${braceletId} passe à l'hôpital suivant de la cascade.`,
          url: `/patients/${req.patientId}/transfert/${req.id}`,
        }),
    ];
  }
  return [
    () =>
      notifyRole("regulateur", {
        kind: "transfer.exhausted",
        title: "Cascade épuisée — intervention requise",
        body: `Aucun hôpital n'a accepté ${braceletId}. Forçage ou nouvelle cascade nécessaire.`,
        url: `/regulation/demandes/${req.id}`,
      }),
    () =>
      notifyUser(req.createdBy, {
        kind: "transfer.exhausted",
        title: "Aucun hôpital n'a accepté",
        body: `Le régulateur est alerté pour ${braceletId} et va orienter manuellement.`,
        url: `/patients/${req.patientId}/transfert/${req.id}`,
      }),
  ];
}

/* ============================ Expirations (job) ============================ */

export async function expireDueTransfers(): Promise<number> {
  const due = await db
    .select({ id: transferRequests.id })
    .from(transferRequests)
    .where(
      and(
        eq(transferRequests.status, "pending"),
        isNotNull(transferRequests.hopSentAt),
        sql`${transferRequests.hopSentAt} + (${transferRequests.timeoutMinutes} || ' minutes')::interval < now()`,
      ),
    );

  let count = 0;
  for (const { id } of due) {
    let notifyAfter: (() => Promise<void>)[] = [];
    await db.transaction(async (tx) => {
      const req = await loadForUpdate(tx, id);
      if (!req || req.status !== "pending" || !req.hopSentAt) return;
      const deadline =
        new Date(req.hopSentAt).getTime() + req.timeoutMinutes * 60_000;
      if (deadline > Date.now()) return;
      const entry = req.cascade[req.currentIndex];
      if (!entry) return;
      const patient = (
        await tx.select().from(patients).where(eq(patients.id, req.patientId)).limit(1)
      )[0]!;
      const adv = await advanceCascade(tx, req, "expired", {
        siteId: entry.siteId,
        reason: `Sans réponse après ${req.timeoutMinutes} min.`,
      });
      await audit(
        {
          action: "transfer.expire",
          entityType: "transfer_request",
          entityId: req.id,
          after: { hop: entry.siteName },
        },
        tx,
      );
      notifyAfter = buildAdvanceNotifications(adv, req, patient.braceletId);
      count++;
    });
    for (const n of notifyAfter) await n();
  }
  return count;
}

/* ============================ Forçage / annulation / arrivée ============================ */

export async function forceTransfer(
  actor: SessionUser,
  requestId: string,
  targetSiteId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!can.forceTransfer(actor)) return { ok: false, error: "Réservé au régulateur." };
  if (!reason.trim()) return { ok: false, error: "Le motif est obligatoire." };

  let notifyAfter: (() => Promise<void>)[] = [];
  const result = await db.transaction(async (tx) => {
    const req = await loadForUpdate(tx, requestId);
    if (!req) return { ok: false as const, error: "Demande introuvable." };
    if (!["pending", "accepted", "forced"].includes(req.status))
      return { ok: false as const, error: `Impossible de forcer une demande « ${req.status} ».` };

    const target = (
      await tx.select().from(sites).where(eq(sites.id, targetSiteId)).limit(1)
    )[0];
    if (!target || !target.active || target.kind === "triage_point")
      return { ok: false as const, error: "Hôpital cible invalide." };

    const patient = (
      await tx.select().from(patients).where(eq(patients.id, req.patientId)).limit(1)
    )[0]!;

    // Libère l'éventuelle réservation précédente.
    const prev = await hasActiveReservation(tx, req.id);
    if (prev) {
      await releaseBed(
        tx,
        prev.siteId,
        req.bedType,
        actor.userId,
        `Réassignation transfert ${patient.braceletId}`,
      );
      await tx.insert(transferEvents).values({
        requestId: req.id,
        type: "reassigned",
        siteId: prev.siteId,
        byUserId: actor.userId,
        meta: { released: true },
      });
    }

    // Réserve dans la cible si possible (sinon forçage quand même, tracé).
    const reserved = await reserveBed(
      tx,
      targetSiteId,
      req.bedType,
      actor.userId,
      `Réservation (forçage) ${patient.braceletId}`,
    );

    await tx
      .update(transferRequests)
      .set({
        status: "forced",
        acceptedBySiteId: targetSiteId,
        acceptedAt: new Date(),
        hopSentAt: null,
        exhausted: false,
      })
      .where(eq(transferRequests.id, req.id));
    await tx.insert(transferEvents).values({
      requestId: req.id,
      type: "forced",
      siteId: targetSiteId,
      byUserId: actor.userId,
      reason,
      meta: { reserved },
    });
    await audit(
      {
        userId: actor.userId,
        role: actor.role,
        action: "transfer.force",
        entityType: "transfer_request",
        entityId: req.id,
        after: { target: target.name, reason, reserved },
      },
      tx,
    );

    notifyAfter = [
      () =>
        notifySiteReferents(targetSiteId, {
          kind: "transfer.forced",
          title: "Patient orienté vers votre hôpital (régulation)",
          body: `${patient.braceletId} (classe ${req.orientationClass}) vous est adressé par le régulateur.${reserved ? "" : " Attention : aucun lit libre déclaré."}`,
          url: `/hopital/attendus`,
        }),
      () =>
        notifyUser(req.createdBy, {
          kind: "transfer.forced",
          title: `Destination fixée — ${target.name}`,
          body: `Le régulateur a orienté ${patient.braceletId} vers ${target.name}. Téléphone : ${target.phone ?? "non renseigné"}.`,
          url: `/patients/${req.patientId}/transfert/${req.id}`,
        }),
    ];
    return { ok: true as const };
  });
  for (const n of notifyAfter) await n();
  return result;
}

export async function cancelTransfer(
  actor: SessionUser,
  requestId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await db.transaction(async (tx) => {
    const req = await loadForUpdate(tx, requestId);
    if (!req) return { ok: false as const, error: "Demande introuvable." };
    const patient = (
      await tx.select().from(patients).where(eq(patients.id, req.patientId)).limit(1)
    )[0]!;
    if (!can.cancelTransfer(actor, patient.siteId))
      return { ok: false as const, error: "Accès refusé." };
    if (!["pending", "accepted", "forced"].includes(req.status))
      return { ok: false as const, error: `Impossible d'annuler une demande « ${req.status} ».` };

    const prev = await hasActiveReservation(tx, req.id);
    if (prev) {
      await releaseBed(
        tx,
        prev.siteId,
        req.bedType,
        actor.userId,
        `Annulation transfert ${patient.braceletId}`,
      );
    }
    await tx
      .update(transferRequests)
      .set({ status: "cancelled", cancelledAt: new Date(), hopSentAt: null })
      .where(eq(transferRequests.id, req.id));
    await tx.insert(transferEvents).values({
      requestId: req.id,
      type: "cancelled",
      byUserId: actor.userId,
      reason: reason.trim() || null,
      meta: prev ? { released: true } : null,
    });
    await audit(
      {
        userId: actor.userId,
        role: actor.role,
        action: "transfer.cancel",
        entityType: "transfer_request",
        entityId: req.id,
        after: { reason },
      },
      tx,
    );
    return { ok: true as const };
  });
  return result;
}

export async function markArrived(
  actor: SessionUser,
  requestId: string,
): Promise<{ ok: boolean; error?: string }> {
  const result = await db.transaction(async (tx) => {
    const req = await loadForUpdate(tx, requestId);
    if (!req) return { ok: false as const, error: "Demande introuvable." };
    if (!["accepted", "forced"].includes(req.status))
      return { ok: false as const, error: "Ce patient n'est pas en transfert accepté." };
    if (!can.markArrived(actor, req.acceptedBySiteId))
      return { ok: false as const, error: "Accès refusé." };

    await tx
      .update(transferRequests)
      .set({ status: "arrived", arrivedAt: new Date() })
      .where(eq(transferRequests.id, req.id));
    await tx.insert(transferEvents).values({
      requestId: req.id,
      type: "arrived",
      siteId: req.acceptedBySiteId,
      byUserId: actor.userId,
    });
    await audit(
      {
        userId: actor.userId,
        role: actor.role,
        action: "transfer.arrived",
        entityType: "transfer_request",
        entityId: req.id,
      },
      tx,
    );
    return { ok: true as const, createdBy: req.createdBy, patientId: req.patientId };
  });

  if (result.ok && "createdBy" in result) {
    await notifyUser(result.createdBy, {
      kind: "transfer.arrived",
      title: "Patient arrivé à destination",
      body: "L'hôpital d'accueil a confirmé l'arrivée du patient.",
      url: `/patients/${result.patientId}`,
    });
    return { ok: true };
  }
  return result;
}
