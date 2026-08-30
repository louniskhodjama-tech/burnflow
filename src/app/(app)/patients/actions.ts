"use server";

import { redirect } from "next/navigation";
import { and, desc, eq, max } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { assessments, careActions, patients, sites } from "@/db/schema";
import { clientIp, requireActor } from "@/lib/auth";
import { can } from "@/lib/policy";
import { audit } from "@/lib/audit";
import { getCurrentRules } from "@/lib/rules";
import { computeScoring, type RegionsInput } from "@/lib/burn-scoring";
import {
  assessmentPayloadSchema,
  newPatientSchema,
} from "@/lib/validation";
import { checkAssessmentCoherence } from "@/lib/agent/coherence";

const num = (v: FormDataEntryValue | null): number | null => {
  const s = String(v ?? "").trim().replace(",", ".");
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
};
const bool = (v: FormDataEntryValue | null): boolean => v === "on" || v === "true";

export async function createPatient(formData: FormData): Promise<void> {
  const actor = await requireActor("urgentiste");

  const parsed = newPatientSchema.safeParse({
    siteId: String(formData.get("siteId") ?? ""),
    braceletId: String(formData.get("braceletId") ?? ""),
    age: num(formData.get("age")),
    weightKg: num(formData.get("weightKg")),
    mechanism: String(formData.get("mechanism") ?? "flamme"),
    hoursSinceBurn: num(formData.get("hoursSinceBurn")),
    inhalation: bool(formData.get("inhalation")),
    closedSpace: bool(formData.get("closedSpace")),
    trauma: bool(formData.get("trauma")),
    comorbidity: bool(formData.get("comorbidity")),
  });
  if (!parsed.success) redirect("/patients/new?error=champs");
  const data = parsed.data;

  if (!can.createPatient(actor, data.siteId)) redirect("/patients?error=droit");

  const burnedAt =
    data.hoursSinceBurn != null
      ? new Date(Date.now() - data.hoursSinceBurn * 3600 * 1000)
      : null;

  let patientId: string;
  try {
    const inserted = await db
      .insert(patients)
      .values({
        braceletId: data.braceletId,
        siteId: data.siteId,
        age: data.age?.toString() ?? null,
        weightKg: data.weightKg?.toString() ?? null,
        mechanism: data.mechanism,
        burnedAt,
        inhalation: data.inhalation,
        closedSpace: data.closedSpace,
        trauma: data.trauma,
        comorbidity: data.comorbidity,
        createdBy: actor.userId,
      })
      .returning({ id: patients.id });
    patientId = inserted[0]!.id;
  } catch (e: unknown) {
    const pgCode = (e as { cause?: { code?: string }; code?: string });
    if (pgCode.code === "23505" || pgCode.cause?.code === "23505") {
      redirect("/patients/new?error=bracelet");
    }
    throw e;
  }

  await audit({
    userId: actor.userId,
    role: actor.role,
    action: "patient.create",
    entityType: "patient",
    entityId: patientId,
    after: { braceletId: data.braceletId, siteId: data.siteId },
    ip: await clientIp(),
  });

  redirect(`/patients/${patientId}/triage`);
}

export async function saveAssessment(
  patientId: string,
  payloadJson: string,
): Promise<{ ok: boolean; error?: string; warnings?: string[] }> {
  const actor = await requireActor("urgentiste");

  const patient = (
    await db.select().from(patients).where(eq(patients.id, patientId)).limit(1)
  )[0];
  if (!patient) return { ok: false, error: "Patient introuvable." };
  if (!can.createAssessment(actor, patient.siteId))
    return { ok: false, error: "Accès refusé pour ce site." };

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(payloadJson);
  } catch {
    return { ok: false, error: "Données illisibles." };
  }
  const parsed = assessmentPayloadSchema.safeParse(parsedPayload);
  if (!parsed.success)
    return { ok: false, error: "Saisie invalide : " + parsed.error.issues[0]?.message };
  const data = parsed.data;

  const { version: rulesVersion, config } = await getCurrentRules();

  // Le serveur recalcule — la valeur affichée côté client n'est jamais la référence.
  const scoring = computeScoring(data.regions as RegionsInput, {
    age: data.age,
    weightKg: data.weightKg,
    hoursSinceBurn: data.hoursSinceBurn,
    mechanism: data.mechanism,
    inhalation: data.inhalation,
    closedSpace: data.closedSpace,
    trauma: data.trauma,
    comorbidity: data.comorbidity,
  }, config);

  const burnedAt =
    data.hoursSinceBurn != null
      ? new Date(Date.now() - data.hoursSinceBurn * 3600 * 1000)
      : null;

  // Contrôle de cohérence IA — suggestif, fail-open (jamais bloquant).
  const aiChecks = await checkAssessmentCoherence({
    factors: data,
    regions: data.regions as RegionsInput,
    scoring,
  });

  const before = {
    age: patient.age,
    weightKg: patient.weightKg,
    mechanism: patient.mechanism,
    inhalation: patient.inhalation,
    closedSpace: patient.closedSpace,
    trauma: patient.trauma,
    comorbidity: patient.comorbidity,
  };

  const assessmentId = await db.transaction(async (tx) => {
    await tx
      .update(patients)
      .set({
        age: data.age?.toString() ?? null,
        weightKg: data.weightKg?.toString() ?? null,
        mechanism: data.mechanism,
        burnedAt,
        inhalation: data.inhalation,
        closedSpace: data.closedSpace,
        trauma: data.trauma,
        comorbidity: data.comorbidity,
      })
      .where(eq(patients.id, patientId));

    const maxV = (
      await tx
        .select({ v: max(assessments.version) })
        .from(assessments)
        .where(eq(assessments.patientId, patientId))
    )[0];
    const version = (maxV?.v ?? 0) + 1;

    const inserted = await tx
      .insert(assessments)
      .values({
        patientId,
        version,
        regions: data.regions as RegionsInput as never,
        scbTotal: scoring.scbTotal.toString(),
        scbDeep: scoring.scbDeep.toString(),
        scbThird: scoring.scbThird.toString(),
        signs: scoring.signs,
        orientationClass: scoring.orientationClass,
        adviceRecommended: scoring.adviceRecommended,
        rulesVersion,
        parkland: scoring.parkland,
        aiChecks: aiChecks.length ? aiChecks : null,
        createdBy: actor.userId,
      })
      .returning({ id: assessments.id });

    await audit(
      {
        userId: actor.userId,
        role: actor.role,
        action: "assessment.create",
        entityType: "assessment",
        entityId: inserted[0]!.id,
        before,
        after: {
          version,
          scbTotal: scoring.scbTotal,
          orientationClass: scoring.orientationClass,
          signs: scoring.signs,
        },
      },
      tx,
    );
    return inserted[0]!.id;
  });

  void assessmentId;
  return { ok: true, warnings: aiChecks };
}

const careToggleSchema = z.object({
  itemKey: z.string().min(3).max(80),
  label: z.string().min(2).max(200),
  sectionTitle: z.string().min(2).max(120),
  done: z.boolean(),
});

/** Coche/décoche un geste de la conduite à tenir — tracé nominativement. */
export async function toggleCareAction(
  patientId: string,
  payload: z.infer<typeof careToggleSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireActor("urgentiste");
  const parsed = careToggleSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Données invalides." };
  const data = parsed.data;

  const patient = (
    await db.select().from(patients).where(eq(patients.id, patientId)).limit(1)
  )[0];
  if (!patient) return { ok: false, error: "Patient introuvable." };
  if (!can.recordCare(actor, patient.siteId))
    return { ok: false, error: "Accès refusé pour ce site." };

  if (data.done) {
    await db
      .insert(careActions)
      .values({
        patientId,
        itemKey: data.itemKey,
        label: data.label,
        sectionTitle: data.sectionTitle,
        byUserId: actor.userId,
      })
      .onConflictDoNothing();
  } else {
    await db
      .delete(careActions)
      .where(
        and(
          eq(careActions.patientId, patientId),
          eq(careActions.itemKey, data.itemKey),
        ),
      );
  }
  await audit({
    userId: actor.userId,
    role: actor.role,
    action: data.done ? "care.check" : "care.uncheck",
    entityType: "patient",
    entityId: patientId,
    after: { geste: data.label },
    ip: await clientIp(),
  });
  return { ok: true };
}
