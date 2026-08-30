import "server-only";
import { and, desc, eq, inArray, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { adviceRequests, assessments, patients } from "@/db/schema";
import { audit } from "@/lib/audit";
import { can } from "@/lib/policy";
import { getCurrentRules } from "@/lib/rules";
import { notifyRole, notifyUser } from "@/lib/notify";
import { generateAdviceSummary } from "@/lib/agent/summaries";
import type { SessionUser } from "@/lib/auth";

export type AdviceRow = typeof adviceRequests.$inferSelect;

/* ============================ Création (urgentiste) ============================ */

export async function createAdvice(
  actor: SessionUser,
  patientId: string,
  question: string,
): Promise<{ ok: true; adviceId: string } | { ok: false; error: string }> {
  const q = question.trim();
  if (q.length < 5) return { ok: false, error: "Formulez votre question." };
  if (q.length > 2000) return { ok: false, error: "Question trop longue (2000 caractères max)." };

  const patient = (
    await db.select().from(patients).where(eq(patients.id, patientId)).limit(1)
  )[0];
  if (!patient) return { ok: false, error: "Patient introuvable." };
  if (!can.createAdviceRequest(actor, patient.siteId))
    return { ok: false, error: "Accès refusé pour ce site." };

  const assessment = (
    await db
      .select()
      .from(assessments)
      .where(eq(assessments.patientId, patientId))
      .orderBy(desc(assessments.version))
      .limit(1)
  )[0];

  const inserted = await db
    .insert(adviceRequests)
    .values({
      patientId,
      assessmentId: assessment?.id ?? null,
      question: q,
      status: "open",
      createdBy: actor.userId,
    })
    .returning({ id: adviceRequests.id });
  const adviceId = inserted[0]!.id;

  await audit({
    userId: actor.userId,
    role: actor.role,
    action: "advice.create",
    entityType: "advice_request",
    entityId: adviceId,
  });

  // Synthèse IA — asynchrone, fail-open.
  void generateAdviceSummary(q, patient, assessment ?? null)
    .then(async (summary) => {
      if (summary) {
        await db
          .update(adviceRequests)
          .set({ aiSummary: summary })
          .where(eq(adviceRequests.id, adviceId));
      }
    })
    .catch(() => {});

  await notifyRole("brulologue", {
    kind: "advice.new",
    title: "Nouvelle demande d'avis brûlologue",
    body: `${patient.braceletId}${assessment ? ` · classe ${assessment.orientationClass} · SCB ${assessment.scbTotal} %` : ""} — premier arrivé, premier servi.`,
    url: `/avis/${adviceId}`,
    relatedType: "advice_request",
    relatedId: adviceId,
  });

  return { ok: true, adviceId };
}

/* ============================ Prise / relâche / réponse ============================ */

/** Prend une demande : verrou en base, un seul gagnant (GOAL §Avis). */
export async function claimAdvice(
  actor: SessionUser,
  adviceId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!can.claimAdvice(actor)) return { ok: false, error: "Réservé aux brûlologues." };

  const updated = await db
    .update(adviceRequests)
    .set({ status: "claimed", claimedBy: actor.userId, claimedAt: new Date() })
    .where(
      and(
        eq(adviceRequests.id, adviceId),
        inArray(adviceRequests.status, ["open", "released"]),
      ),
    )
    .returning({ id: adviceRequests.id });

  if (updated.length === 0)
    return { ok: false, error: "Déjà prise par un autre brûlologue." };

  await audit({
    userId: actor.userId,
    role: actor.role,
    action: "advice.claim",
    entityType: "advice_request",
    entityId: adviceId,
  });
  return { ok: true };
}

export async function releaseAdvice(
  actor: SessionUser,
  adviceId: string,
): Promise<{ ok: boolean; error?: string }> {
  const row = (
    await db.select().from(adviceRequests).where(eq(adviceRequests.id, adviceId)).limit(1)
  )[0];
  if (!row) return { ok: false, error: "Demande introuvable." };
  if (!can.releaseAdvice(actor, row.claimedBy))
    return { ok: false, error: "Vous n'avez pas pris cette demande." };
  if (row.status !== "claimed")
    return { ok: false, error: "Cette demande n'est pas en cours." };

  await db
    .update(adviceRequests)
    .set({ status: "released", claimedBy: null, claimedAt: null })
    .where(and(eq(adviceRequests.id, adviceId), eq(adviceRequests.status, "claimed")));

  await audit({
    userId: actor.userId,
    role: actor.role,
    action: "advice.release",
    entityType: "advice_request",
    entityId: adviceId,
  });
  return { ok: true };
}

export async function answerAdvice(
  actor: SessionUser,
  adviceId: string,
  answer: string,
): Promise<{ ok: boolean; error?: string }> {
  const a = answer.trim();
  if (a.length < 5) return { ok: false, error: "Rédigez votre réponse." };
  if (a.length > 5000) return { ok: false, error: "Réponse trop longue (5000 caractères max)." };

  const row = (
    await db.select().from(adviceRequests).where(eq(adviceRequests.id, adviceId)).limit(1)
  )[0];
  if (!row) return { ok: false, error: "Demande introuvable." };
  if (!can.answerAdvice(actor, row.claimedBy))
    return { ok: false, error: "Vous n'avez pas pris cette demande." };
  if (row.status !== "claimed")
    return { ok: false, error: "Cette demande n'est pas en cours." };

  await db
    .update(adviceRequests)
    .set({
      status: "answered",
      answer: a,
      answeredBy: actor.userId,
      answeredAt: new Date(),
    })
    .where(and(eq(adviceRequests.id, adviceId), eq(adviceRequests.status, "claimed")));

  await audit({
    userId: actor.userId,
    role: actor.role,
    action: "advice.answer",
    entityType: "advice_request",
    entityId: adviceId,
  });

  const patient = (
    await db.select().from(patients).where(eq(patients.id, row.patientId)).limit(1)
  )[0];
  await notifyUser(row.createdBy, {
    kind: "advice.answered",
    title: "Avis brûlologue reçu",
    body: `Réponse disponible pour ${patient?.braceletId ?? "votre patient"}.`,
    url: `/patients/${row.patientId}`,
  });
  return { ok: true };
}

/* ============================ Job : retour en file après délai ============================ */

export async function releaseStaleAdvice(): Promise<number> {
  const { config } = await getCurrentRules();
  const cutoff = new Date(Date.now() - config.routing.adviceReleaseMinutes * 60_000);

  const stale = await db
    .update(adviceRequests)
    .set({ status: "released", claimedBy: null, claimedAt: null })
    .where(
      and(
        eq(adviceRequests.status, "claimed"),
        isNotNull(adviceRequests.claimedAt),
        lt(adviceRequests.claimedAt, cutoff),
      ),
    )
    .returning({ id: adviceRequests.id });

  for (const s of stale) {
    await audit({
      action: "advice.auto_release",
      entityType: "advice_request",
      entityId: s.id,
    });
    await notifyRole("brulologue", {
      kind: "advice.released",
      title: "Une demande d'avis est revenue en file",
      body: `Non répondue après ${config.routing.adviceReleaseMinutes} min — de nouveau disponible.`,
      url: `/avis/${s.id}`,
    });
  }
  return stale.length;
}
