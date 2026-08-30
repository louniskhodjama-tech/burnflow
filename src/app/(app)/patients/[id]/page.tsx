import Link from "next/link";
import { notFound } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adviceRequests, careActions, transferRequests, sites, users } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import {
  getLatestAssessment,
  getPatientForActor,
  hoursSince,
} from "@/lib/patients";
import { ClassChip } from "@/components/class-chip";
import { CarePlan, type CareChecked } from "@/components/care-plan";
import { getCurrentRules } from "@/lib/rules";
import { protocolsForClass, careItemKey } from "@/lib/protocols";

export const dynamic = "force-dynamic";

const MECH_LABELS: Record<string, string> = {
  flamme: "Flamme",
  contact: "Contact / chaleur",
  elec: "Électrique",
  chim: "Chimique",
};

export default async function PatientPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const actor = await requireActor();
  const { id } = await params;
  const found = await getPatientForActor(id, actor);
  if (!found) notFound();
  const { patient, siteName } = found;

  const assessment = await getLatestAssessment(id);
  const transfers = await db
    .select({
      id: transferRequests.id,
      status: transferRequests.status,
      bedType: transferRequests.bedType,
      createdAt: transferRequests.createdAt,
      acceptedName: sites.name,
      acceptedPhone: sites.phone,
    })
    .from(transferRequests)
    .leftJoin(sites, eq(sites.id, transferRequests.acceptedBySiteId))
    .where(eq(transferRequests.patientId, id))
    .orderBy(desc(transferRequests.createdAt));

  const advices = await db
    .select()
    .from(adviceRequests)
    .where(eq(adviceRequests.patientId, id))
    .orderBy(desc(adviceRequests.createdAt));

  // Conduite à tenir : sections de la classe courante + gestes déjà cochés
  const { config } = await getCurrentRules();
  const careSections = assessment
    ? protocolsForClass(config.protocols, assessment.orientationClass as 1 | 2 | 3)
    : [];
  const careRows = assessment
    ? await db
        .select({
          itemKey: careActions.itemKey,
          doneAt: careActions.doneAt,
          byName: users.displayName,
        })
        .from(careActions)
        .innerJoin(users, eq(users.id, careActions.byUserId))
        .where(eq(careActions.patientId, id))
    : [];
  const careChecked: CareChecked = {};
  for (const r of careRows)
    careChecked[r.itemKey] = { doneAt: r.doneAt.toISOString(), byName: r.byName };

  const delay = hoursSince(patient.burnedAt);
  const isUrgentiste = actor.role === "urgentiste";
  const activeTransfer = transfers.find((t) =>
    ["pending", "accepted", "forced"].includes(t.status),
  );

  const flags = [
    patient.inhalation && "Inhalation suspectée",
    patient.closedSpace && "Espace clos",
    patient.trauma && "Trauma associé",
    patient.comorbidity && "Comorbidité",
  ].filter(Boolean) as string[];

  return (
    <div className="flex flex-col gap-2 pb-6">
      <div className="flex items-center justify-between pt-2">
        <div>
          <h1 className="text-xl font-bold">{patient.braceletId}</h1>
          <p className="text-xs text-muted">{siteName}</p>
        </div>
        {assessment ? (
          <ClassChip
            klass={assessment.orientationClass as 1 | 2 | 3}
            labelOverride={
              assessment.adviceRecommended && assessment.orientationClass === 2
                ? "2 · Réa · avis brûlologue"
                : undefined
            }
          />
        ) : (
          <span className="rounded-md bg-bg px-2 py-1 text-xs text-muted">triage à faire</span>
        )}
      </div>

      <section className="card">
        <h2 className="card-title">Patient</h2>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[15px]">
          <Info label="Âge" value={patient.age != null ? `${Number(patient.age)} ans` : "—"} />
          <Info label="Poids est." value={patient.weightKg != null ? `${Number(patient.weightKg)} kg` : "—"} />
          <Info label="Mécanisme" value={MECH_LABELS[patient.mechanism] ?? patient.mechanism} />
          <Info label="Délai" value={delay != null ? `${delay} h` : "—"} />
        </div>
        {flags.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {flags.map((f) => (
              <span key={f} className="rounded-md bg-bg px-2 py-0.5 text-xs">
                {f}
              </span>
            ))}
          </div>
        )}
      </section>

      {assessment ? (
        <section className="card">
          <h2 className="card-title">
            Triage — v{assessment.version} ·{" "}
            {new Date(assessment.createdAt).toLocaleString("fr-DZ", {
              day: "2-digit",
              month: "2-digit",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </h2>
          <div className="flex items-end gap-3">
            <div>
              <span className="text-4xl font-bold tabular-nums">{assessment.scbTotal}</span>
              <span className="ml-1 text-sm text-muted">% SCB</span>
            </div>
            <div className="pb-1 text-sm text-muted">
              dont <b className="text-ink">{assessment.scbDeep}</b> % profond ·{" "}
              <b className="text-ink">{assessment.scbThird}</b> % 3e degré
            </div>
          </div>
          {(assessment.signs?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {assessment.signs!.map((s) => (
                <span key={s} className="rounded-md bg-ink/10 px-2 py-0.5 text-xs">
                  {s}
                </span>
              ))}
            </div>
          )}
          {assessment.parkland && (
            <p className="mt-2 text-[13px] text-muted">{assessment.parkland.text}</p>
          )}
          {assessment.aiChecks && assessment.aiChecks.length > 0 && (
            <div className="mt-2 rounded-lg border border-rea bg-rea/5 p-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-rea">
                Contrôle de cohérence (suggestif)
              </p>
              <ul className="mt-1 list-disc pl-4 text-[13px]">
                {assessment.aiChecks.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            </div>
          )}
          {isUrgentiste && (
            <Link href={`/patients/${id}/triage`} className="btn-base mt-3 w-full">
              Modifier le triage (nouvelle version)
            </Link>
          )}
        </section>
      ) : (
        isUrgentiste && (
          <Link href={`/patients/${id}/triage`} className="btn-primary w-full">
            Saisir le triage
          </Link>
        )
      )}

      {assessment && careSections.length > 0 && (
        <CarePlan
          patientId={id}
          sections={careSections}
          checked={careChecked}
          readOnly={!isUrgentiste}
        />
      )}

      {isUrgentiste && assessment && (
        <div className="flex gap-2">
          {!activeTransfer && (
            <Link href={`/patients/${id}/transfert`} className="btn-primary flex-1">
              Demander un transfert
            </Link>
          )}
          <Link href={`/patients/${id}/avis`} className="btn-base flex-1">
            Demander un avis
          </Link>
        </div>
      )}

      {transfers.length > 0 && (
        <section className="card">
          <h2 className="card-title">Transferts</h2>
          <ul className="flex flex-col gap-2">
            {transfers.map((t) => (
              <li key={t.id} className="rounded-lg border border-line p-2">
                <Link href={`/patients/${id}/transfert/${t.id}`} className="block">
                  <div className="flex items-center justify-between">
                    <span className="text-[15px] font-medium">
                      {statusLabel(t.status)}
                      {t.acceptedName ? ` — ${t.acceptedName}` : ""}
                    </span>
                    <span className="text-xs text-muted">
                      {new Date(t.createdAt).toLocaleTimeString("fr-DZ", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  {t.acceptedPhone && (
                    <div className="text-xs text-muted">Service : {t.acceptedPhone}</div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {advices.length > 0 && (
        <section className="card">
          <h2 className="card-title">Avis brûlologue</h2>
          <ul className="flex flex-col gap-2">
            {advices.map((a) => (
              <li key={a.id} className="rounded-lg border border-line p-2">
                <p className="text-[14px] font-medium">{a.question}</p>
                {a.answer ? (
                  <p className="mt-1 whitespace-pre-wrap text-[14px]">{a.answer}</p>
                ) : (
                  <p className="mt-1 text-xs text-muted">
                    {a.status === "claimed" ? "Avis en cours de rédaction…" : "En attente d'un brûlologue…"}
                  </p>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-xs text-muted">{label} : </span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    pending: "Recherche d'hôpital en cours",
    accepted: "Accepté",
    forced: "Orienté par la régulation",
    cancelled: "Annulé",
    arrived: "Arrivé",
    declined: "Refusé",
    expired: "Expiré",
  };
  return map[s] ?? s;
}
