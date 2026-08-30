import { notFound } from "next/navigation";
import { and, desc, eq, ne } from "drizzle-orm";
import { db } from "@/db";
import { adviceRequests, assessments, patients } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { hoursSince } from "@/lib/patients";
import { ClassChip } from "@/components/class-chip";
import { AdviceActions } from "./advice-actions";

export const dynamic = "force-dynamic";

const MECH_LABELS: Record<string, string> = {
  flamme: "Flamme",
  contact: "Contact / chaleur",
  elec: "Électrique",
  chim: "Chimique",
};

export default async function AdviceDetailPage({
  params,
}: {
  params: Promise<{ adviceId: string }>;
}) {
  const actor = await requireActor("brulologue", "regulateur");
  const { adviceId } = await params;

  const advice = (
    await db
      .select()
      .from(adviceRequests)
      .where(eq(adviceRequests.id, adviceId))
      .limit(1)
  )[0];
  if (!advice) notFound();

  const patient = (
    await db.select().from(patients).where(eq(patients.id, advice.patientId)).limit(1)
  )[0]!;
  const assessment = advice.assessmentId
    ? (
        await db
          .select()
          .from(assessments)
          .where(eq(assessments.id, advice.assessmentId))
          .limit(1)
      )[0]
    : (
        await db
          .select()
          .from(assessments)
          .where(eq(assessments.patientId, advice.patientId))
          .orderBy(desc(assessments.version))
          .limit(1)
      )[0];

  const history = await db
    .select()
    .from(adviceRequests)
    .where(
      and(
        eq(adviceRequests.patientId, advice.patientId),
        ne(adviceRequests.id, adviceId),
      ),
    )
    .orderBy(desc(adviceRequests.createdAt));

  const delay = hoursSince(patient.burnedAt);
  const isMine = advice.claimedBy === actor.userId;
  const isBrulologue = actor.role === "brulologue";

  const statusText =
    advice.status === "answered"
      ? "Répondu"
      : advice.status === "claimed"
        ? isMine
          ? "Pris par vous — répondez ci-dessous"
          : "Déjà pris par un autre brûlologue"
        : "En attente — premier arrivé, premier servi";

  return (
    <div className="flex flex-col gap-2 pb-6">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-semibold">Avis — {patient.braceletId}</h1>
        {assessment && (
          <ClassChip klass={assessment.orientationClass as 1 | 2 | 3} small />
        )}
      </div>

      <div
        className={`card ${advice.status === "answered" ? "border-chir" : isMine ? "border-rea" : ""}`}
      >
        <p className="text-[14px]">{statusText}</p>
      </div>

      <section className="card">
        <h2 className="card-title">Question de l&apos;urgentiste</h2>
        <p className="whitespace-pre-wrap text-[15px] leading-6">{advice.question}</p>
      </section>

      {advice.aiSummary && (
        <section className="card">
          <h2 className="card-title">Synthèse (rédigée automatiquement)</h2>
          <p className="whitespace-pre-wrap text-[14px] leading-6">{advice.aiSummary}</p>
        </section>
      )}

      <section className="card">
        <h2 className="card-title">Fiche clinique pseudonymisée</h2>
        {assessment ? (
          <>
            <div className="flex items-end gap-3">
              <div>
                <span className="text-3xl font-bold tabular-nums">{assessment.scbTotal}</span>
                <span className="ml-1 text-sm text-muted">% SCB</span>
              </div>
              <div className="pb-1 text-[13px] text-muted">
                profond {assessment.scbDeep} % · 3e {assessment.scbThird} %
              </div>
            </div>
            {(assessment.signs?.length ?? 0) > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {assessment.signs!.map((s) => (
                  <span key={s} className="rounded-md bg-ink/10 px-2 py-0.5 text-xs">{s}</span>
                ))}
              </div>
            )}
            {assessment.parkland && (
              <p className="mt-2 text-[13px] text-muted">{assessment.parkland.text}</p>
            )}
          </>
        ) : (
          <p className="text-[14px] text-muted">Pas encore de triage saisi.</p>
        )}
        <div className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-[14px]">
          <span>Âge : <b>{patient.age != null ? Number(patient.age) : "—"}</b> ans</span>
          <span>Poids : <b>{patient.weightKg != null ? Number(patient.weightKg) : "—"}</b> kg</span>
          <span>Mécanisme : <b>{MECH_LABELS[patient.mechanism]}</b></span>
          <span>Délai : <b>{delay ?? "—"}</b> h</span>
          <span>Inhalation : <b>{patient.inhalation ? "oui" : "non"}</b></span>
          <span>Espace clos : <b>{patient.closedSpace ? "oui" : "non"}</b></span>
        </div>
      </section>

      {advice.answer && (
        <section className="card border-chir">
          <h2 className="card-title">Réponse</h2>
          <p className="whitespace-pre-wrap text-[15px] leading-6">{advice.answer}</p>
          <p className="mt-1 text-xs text-muted">
            {advice.answeredAt
              ? new Date(advice.answeredAt).toLocaleString("fr-DZ")
              : ""}
          </p>
        </section>
      )}

      {history.length > 0 && (
        <section className="card">
          <h2 className="card-title">Autres avis de ce patient</h2>
          <ul className="flex flex-col gap-2">
            {history.map((h) => (
              <li key={h.id} className="rounded-lg border border-line p-2 text-[13px]">
                <p className="font-medium">{h.question}</p>
                {h.answer && <p className="mt-1 whitespace-pre-wrap text-muted">{h.answer}</p>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {isBrulologue && advice.status !== "answered" && (
        <AdviceActions
          adviceId={adviceId}
          state={
            advice.status === "claimed" ? (isMine ? "mine" : "taken") : "open"
          }
        />
      )}
    </div>
  );
}
