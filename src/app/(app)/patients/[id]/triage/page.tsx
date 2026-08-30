import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { can } from "@/lib/policy";
import {
  getLatestAssessment,
  getPatientForActor,
  hoursSince,
} from "@/lib/patients";
import { getCurrentRules } from "@/lib/rules";
import { TriageForm } from "./triage-form";
import type { RegionsInput } from "@/lib/burn-scoring";

export const dynamic = "force-dynamic";

export default async function TriagePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor("urgentiste");
  const { id } = await params;
  const found = await getPatientForActor(id, actor);
  if (!found) notFound();
  if (!can.createAssessment(actor, found.patient.siteId)) notFound();

  const latest = await getLatestAssessment(id);
  const { config } = await getCurrentRules();

  const p = found.patient;
  return (
    <TriageForm
      patientId={id}
      braceletId={p.braceletId}
      initialFactors={{
        age: p.age != null ? Number(p.age) : null,
        weightKg: p.weightKg != null ? Number(p.weightKg) : null,
        hoursSinceBurn: hoursSince(p.burnedAt),
        mechanism: p.mechanism,
        inhalation: p.inhalation,
        closedSpace: p.closedSpace,
        trauma: p.trauma,
        comorbidity: p.comorbidity,
      }}
      initialRegions={(latest?.regions as RegionsInput | undefined) ?? null}
      clinicalRules={{
        reaSCB: config.reaSCB,
        childBelow: config.childBelow,
        elderlyAbove: config.elderlyAbove,
        thirdDegreeSign: config.thirdDegreeSign,
        parklandMlKgPct: config.parklandMlKgPct,
      }}
    />
  );
}
