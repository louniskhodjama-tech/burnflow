import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assessments, careActions, patients, transferRequests, users } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { ClassChip } from "@/components/class-chip";
import { Countdown } from "@/components/countdown";
import { hoursSince } from "@/lib/patients";
import { RespondForm } from "./respond-form";

export const dynamic = "force-dynamic";

const MECH_LABELS: Record<string, string> = {
  flamme: "Flamme",
  contact: "Contact / chaleur",
  elec: "Électrique",
  chim: "Chimique",
};

export default async function DemandeDetailPage({
  params,
}: {
  params: Promise<{ reqId: string }>;
}) {
  const actor = await requireActor("referent");
  const { reqId } = await params;

  const req = (
    await db
      .select()
      .from(transferRequests)
      .where(eq(transferRequests.id, reqId))
      .limit(1)
  )[0];
  if (!req) notFound();

  const currentHop = req.cascade[req.currentIndex];
  const isMine =
    (req.status === "pending" && currentHop && actor.siteIds.includes(currentHop.siteId)) ||
    (req.acceptedBySiteId != null && actor.siteIds.includes(req.acceptedBySiteId));
  if (!isMine) notFound();

  const patient = (
    await db.select().from(patients).where(eq(patients.id, req.patientId)).limit(1)
  )[0]!;
  const assessment = (
    await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, req.assessmentId))
      .limit(1)
  )[0]!;

  const careDone = await db
    .select({
      label: careActions.label,
      doneAt: careActions.doneAt,
      byName: users.displayName,
    })
    .from(careActions)
    .innerJoin(users, eq(users.id, careActions.byUserId))
    .where(eq(careActions.patientId, req.patientId))
    .orderBy(careActions.doneAt);

  const deadline =
    req.status === "pending" && req.hopSentAt
      ? new Date(
          new Date(req.hopSentAt).getTime() + req.timeoutMinutes * 60_000,
        ).toISOString()
      : null;

  const delay = hoursSince(patient.burnedAt);
  const flags = [
    patient.inhalation && "inhalation",
    patient.closedSpace && "espace clos",
    patient.trauma && "trauma",
    patient.comorbidity && "comorbidité",
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-2 pb-6">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-semibold">Demande — {patient.braceletId}</h1>
        <ClassChip klass={req.orientationClass as 1 | 2 | 3} />
      </div>

      {deadline && (
        <div className="card border-rea">
          <p className="text-[15px]">
            Réponse attendue avant : <Countdown deadline={deadline} /> — sans
            réponse, la demande bascule automatiquement à l&apos;hôpital suivant.
          </p>
        </div>
      )}

      <section className="card">
        <h2 className="card-title">Bilan clinique</h2>
        <div className="flex items-end gap-3">
          <div>
            <span className="text-3xl font-bold tabular-nums">{assessment.scbTotal}</span>
            <span className="ml-1 text-sm text-muted">% SCB</span>
          </div>
          <div className="pb-1 text-[13px] text-muted">
            profond {assessment.scbDeep} % · 3e {assessment.scbThird} %
          </div>
        </div>
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[14px]">
          <span>Âge : <b>{patient.age != null ? Number(patient.age) : "—"}</b> ans</span>
          <span>Poids : <b>{patient.weightKg != null ? Number(patient.weightKg) : "—"}</b> kg</span>
          <span>Mécanisme : <b>{MECH_LABELS[patient.mechanism]}</b></span>
          <span>Délai : <b>{delay ?? "—"}</b> h</span>
        </div>
        {(assessment.signs?.length ?? 0) > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {assessment.signs!.map((s) => (
              <span key={s} className="rounded-md bg-ink/10 px-2 py-0.5 text-xs">{s}</span>
            ))}
          </div>
        )}
        {flags.length > 0 && (
          <p className="mt-1 text-[13px] text-muted">Drapeaux : {flags.join(", ")}.</p>
        )}
        {assessment.parkland && (
          <p className="mt-2 text-[13px] text-muted">{assessment.parkland.text}</p>
        )}
      </section>

      {careDone.length > 0 && (
        <section className="card">
          <h2 className="card-title">Gestes réalisés sur le terrain</h2>
          <ul className="flex flex-col gap-0.5 text-[13px]">
            {careDone.map((g, i) => (
              <li key={i}>
                ✓ {g.label}{" "}
                <span className="text-muted">
                  — {new Date(g.doneAt).toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {req.summary && (
        <section className="card">
          <h2 className="card-title">Fiche de transfert (rédigée automatiquement)</h2>
          <p className="whitespace-pre-wrap text-[14px] leading-6">{req.summary}</p>
        </section>
      )}

      {req.status === "pending" ? (
        <RespondForm requestId={req.id} bedType={req.bedType} />
      ) : (
        <div className="card">
          <p className="text-[15px]">
            Statut : <b>{req.status === "accepted" ? "acceptée par votre hôpital" : req.status}</b>
          </p>
        </div>
      )}
    </div>
  );
}
