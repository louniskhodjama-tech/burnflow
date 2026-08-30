import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { assessments, careActions, transferRequests, users } from "@/db/schema";
import { getCurrentRules } from "@/lib/rules";
import { protocolsForClass } from "@/lib/protocols";
import { requireActor } from "@/lib/auth";
import { getPatientForActor, hoursSince } from "@/lib/patients";
import { buildDeterministicFiche } from "@/lib/fiche";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

export default async function PrintTransferPage({
  params,
}: {
  params: Promise<{ id: string; reqId: string }>;
}) {
  const actor = await requireActor();
  const { id, reqId } = await params;
  const found = await getPatientForActor(id, actor);
  if (!found) notFound();

  const req = (
    await db
      .select()
      .from(transferRequests)
      .where(eq(transferRequests.id, reqId))
      .limit(1)
  )[0];
  if (!req || req.patientId !== id) notFound();

  const assessment = (
    await db
      .select()
      .from(assessments)
      .where(eq(assessments.id, req.assessmentId))
      .limit(1)
  )[0];
  if (!assessment) notFound();

  const { config } = await getCurrentRules();
  const careSections = protocolsForClass(
    config.protocols,
    assessment.orientationClass as 1 | 2 | 3,
  );
  const careDone = await db
    .select({
      label: careActions.label,
      sectionTitle: careActions.sectionTitle,
      doneAt: careActions.doneAt,
      byName: users.displayName,
    })
    .from(careActions)
    .innerJoin(users, eq(users.id, careActions.byUserId))
    .where(eq(careActions.patientId, id))
    .orderBy(careActions.doneAt);

  const p = found.patient;
  const fallback = buildDeterministicFiche({
    braceletId: p.braceletId,
    age: p.age != null ? Number(p.age) : null,
    weightKg: p.weightKg != null ? Number(p.weightKg) : null,
    hoursSinceBurn: hoursSince(p.burnedAt),
    regions: assessment.regions,
    scbTotal: Number(assessment.scbTotal),
    scbDeep: Number(assessment.scbDeep),
    scbThird: Number(assessment.scbThird),
    orientationClass: assessment.orientationClass as 1 | 2 | 3,
    why: assessment.signs ?? [],
    parklandText: assessment.parkland?.text ?? null,
  });

  return (
    <div className="pb-6 print:pb-0">
      <div className="flex items-center justify-between py-2 print:hidden">
        <h1 className="text-lg font-semibold">Fiche de transfert</h1>
        <PrintButton />
      </div>

      {req.summary && (
        <section className="card mb-2 print:border-0 print:p-0">
          <h2 className="card-title">Synthèse clinique (rédigée automatiquement)</h2>
          <p className="whitespace-pre-wrap text-[15px] leading-6">{req.summary}</p>
        </section>
      )}

      {careDone.length > 0 && (
        <section className="card mb-2 print:border-0 print:p-0">
          <h2 className="card-title">Gestes réalisés avant transfert</h2>
          <ul className="flex flex-col gap-0.5 text-[13px]">
            {careDone.map((g, i) => (
              <li key={i}>
                ✓ {g.label}{" "}
                <span className="text-muted">
                  — {new Date(g.doneAt).toLocaleTimeString("fr-DZ", { hour: "2-digit", minute: "2-digit" })} · {g.byName}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {careSections.length > 0 && (
        <section className="card mb-2 print:border-0 print:p-0">
          <h2 className="card-title">Conduite à tenir (protocole de la régulation)</h2>
          {careSections.map((s) => (
            <div key={s.id} className="mb-2">
              <p className="text-[13px] font-semibold">{s.title}</p>
              <p className="whitespace-pre-wrap text-[12px] leading-5 text-muted">{s.content}</p>
            </div>
          ))}
        </section>
      )}

      <section className="card print:border-0 print:p-0">
        <h2 className="card-title">Données structurées</h2>
        <pre className="whitespace-pre-wrap rounded-lg border border-line bg-bg p-2 font-mono text-[12px] leading-5">
          {fallback}
        </pre>
      </section>
    </div>
  );
}
