import "server-only";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  adviceRequests,
  assessments,
  patients,
  sites,
  transferRequests,
} from "@/db/schema";
import { can } from "@/lib/policy";
import type { SessionUser } from "@/lib/auth";

export type PatientRow = typeof patients.$inferSelect;
export type AssessmentRow = typeof assessments.$inferSelect;

/** Charge un patient et vérifie le droit de lecture selon la matrice des rôles. */
export async function getPatientForActor(
  patientId: string,
  actor: SessionUser,
): Promise<{ patient: PatientRow; siteName: string } | null> {
  const row = (
    await db
      .select({ patient: patients, siteName: sites.name })
      .from(patients)
      .innerJoin(sites, eq(sites.id, patients.siteId))
      .where(eq(patients.id, patientId))
      .limit(1)
  )[0];
  if (!row) return null;

  let acceptedBySiteId: string | null = null;
  if (actor.role === "referent" && actor.siteIds.length) {
    const t = (
      await db
        .select({ acceptedBySiteId: transferRequests.acceptedBySiteId })
        .from(transferRequests)
        .where(
          and(
            eq(transferRequests.patientId, patientId),
            inArray(transferRequests.acceptedBySiteId, actor.siteIds),
          ),
        )
        .limit(1)
    )[0];
    acceptedBySiteId = t?.acceptedBySiteId ?? null;
  }

  let hasAdviceRequest = false;
  if (actor.role === "brulologue") {
    const a = (
      await db
        .select({ id: adviceRequests.id })
        .from(adviceRequests)
        .where(eq(adviceRequests.patientId, patientId))
        .limit(1)
    )[0];
    hasAdviceRequest = !!a;
  }

  const ok = can.viewPatient(actor, {
    triageSiteId: row.patient.siteId,
    acceptedBySiteId,
    hasAdviceRequest,
  });
  if (!ok) return null;
  return { patient: row.patient, siteName: row.siteName };
}

export async function getLatestAssessment(
  patientId: string,
): Promise<AssessmentRow | null> {
  const row = (
    await db
      .select()
      .from(assessments)
      .where(eq(assessments.patientId, patientId))
      .orderBy(desc(assessments.version))
      .limit(1)
  )[0];
  return row ?? null;
}

/** Délai depuis la brûlure, en heures (0,1 près), à partir de burned_at. */
export function hoursSince(burnedAt: Date | null): number | null {
  if (!burnedAt) return null;
  const h = (Date.now() - burnedAt.getTime()) / 3_600_000;
  return Math.max(0, Math.round(h * 10) / 10);
}
