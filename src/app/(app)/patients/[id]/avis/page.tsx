import { notFound } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { getLatestAssessment, getPatientForActor } from "@/lib/patients";
import { ClassChip } from "@/components/class-chip";
import { AdviceForm } from "./advice-form";

export const dynamic = "force-dynamic";

export default async function NewAdvicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor("urgentiste");
  const { id } = await params;
  const found = await getPatientForActor(id, actor);
  if (!found) notFound();
  const assessment = await getLatestAssessment(id);

  return (
    <div className="flex flex-col gap-2 pb-6">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-semibold">
          Avis brûlologue — {found.patient.braceletId}
        </h1>
        {assessment && <ClassChip klass={assessment.orientationClass as 1 | 2 | 3} small />}
      </div>

      <section className="card">
        <p className="text-[14px] text-muted">
          Votre question part dans la file nationale : le premier brûlologue
          disponible la prend et vous répond. La fiche clinique pseudonymisée du
          patient est jointe automatiquement.
        </p>
      </section>

      <AdviceForm patientId={id} />
    </div>
  );
}
