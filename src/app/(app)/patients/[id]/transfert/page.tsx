import { notFound, redirect } from "next/navigation";
import { desc, eq, inArray, and } from "drizzle-orm";
import { db } from "@/db";
import { transferRequests } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { getLatestAssessment, getPatientForActor } from "@/lib/patients";
import { ClassChip } from "@/components/class-chip";
import { LaunchTransferButton } from "./launch-button";

export const dynamic = "force-dynamic";

export default async function NewTransferPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor("urgentiste");
  const { id } = await params;
  const found = await getPatientForActor(id, actor);
  if (!found) notFound();

  const active = (
    await db
      .select({ id: transferRequests.id })
      .from(transferRequests)
      .where(
        and(
          eq(transferRequests.patientId, id),
          inArray(transferRequests.status, ["pending", "accepted", "forced"]),
        ),
      )
      .orderBy(desc(transferRequests.createdAt))
      .limit(1)
  )[0];
  if (active) redirect(`/patients/${id}/transfert/${active.id}`);

  const assessment = await getLatestAssessment(id);
  if (!assessment) redirect(`/patients/${id}/triage`);

  const klass = assessment.orientationClass as 1 | 2 | 3;
  const bedLabel =
    klass === 1
      ? "un lit d'hospitalisation en service de chirurgie"
      : klass === 2
        ? "un lit de réanimation"
        : "une place en centre des brûlés (ou réanimation en dernier recours)";

  return (
    <div className="flex flex-col gap-2 pb-6">
      <h1 className="pt-2 text-lg font-semibold">
        Demande de transfert — {found.patient.braceletId}
      </h1>

      <section className="card">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[15px]">
              SCB <b>{assessment.scbTotal} %</b> · triage v{assessment.version}
            </p>
            <p className="mt-1 text-[13px] text-muted">Recherche : {bedLabel}.</p>
          </div>
          <ClassChip klass={klass} />
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Comment ça marche</h2>
        <ol className="list-decimal pl-5 text-[14px] leading-6">
          <li>Le système classe les hôpitaux compatibles (trajet + charge).</li>
          <li>La demande part au 1er ; il a un délai limité pour répondre.</li>
          <li>Refus ou silence → bascule automatique au suivant.</li>
          <li>Vous êtes notifié dès qu'un hôpital accepte, avec son téléphone.</li>
        </ol>
      </section>

      <LaunchTransferButton patientId={id} />
    </div>
  );
}
