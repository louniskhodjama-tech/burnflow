import Link from "next/link";
import { desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import { assessments, patients, sites, transferRequests } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { ClassChip } from "@/components/class-chip";

export const metadata = { title: "Mes patients — Triage brûlés" };
export const dynamic = "force-dynamic";

export default async function PatientsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const actor = await requireActor("urgentiste");
  const { error } = await searchParams;

  if (actor.siteIds.length === 0) {
    return (
      <div className="card my-2">
        <p className="text-[15px]">
          Aucun point médical ne vous est affecté. Contactez le régulateur.
        </p>
      </div>
    );
  }

  const latestAssessment = db
    .selectDistinctOn([assessments.patientId], {
      patientId: assessments.patientId,
      scbTotal: assessments.scbTotal,
      orientationClass: assessments.orientationClass,
      createdAt: assessments.createdAt,
    })
    .from(assessments)
    .orderBy(assessments.patientId, desc(assessments.version))
    .as("latest");

  const rows = await db
    .select({
      id: patients.id,
      braceletId: patients.braceletId,
      age: patients.age,
      createdAt: patients.createdAt,
      siteName: sites.name,
      scbTotal: latestAssessment.scbTotal,
      orientationClass: latestAssessment.orientationClass,
    })
    .from(patients)
    .innerJoin(sites, eq(sites.id, patients.siteId))
    .leftJoin(latestAssessment, eq(latestAssessment.patientId, patients.id))
    .where(inArray(patients.siteId, actor.siteIds))
    .orderBy(desc(patients.createdAt))
    .limit(200);

  const activeTransfers = rows.length
    ? await db
        .select({
          patientId: transferRequests.patientId,
          status: transferRequests.status,
        })
        .from(transferRequests)
        .where(
          inArray(
            transferRequests.patientId,
            rows.map((r) => r.id),
          ),
        )
        .orderBy(desc(transferRequests.createdAt))
    : [];
  const transferByPatient = new Map<string, string>();
  for (const t of activeTransfers) {
    if (!transferByPatient.has(t.patientId))
      transferByPatient.set(t.patientId, t.status);
  }

  return (
    <div className="pb-4">
      <div className="flex items-center justify-between py-2">
        <h1 className="text-lg font-semibold">Patients de mes sites</h1>
        <Link href="/patients/new" className="btn-primary">
          + Nouveau
        </Link>
      </div>

      {error === "droit" && (
        <div className="card my-2 border-centre">
          <p className="text-centre text-[15px]">Action refusée (droits insuffisants).</p>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="card my-2">
          <p className="text-[15px] text-muted">
            Aucun patient. Créez le premier avec « + Nouveau ».
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((p) => (
            <li key={p.id}>
              <Link href={`/patients/${p.id}`} className="card block active:bg-bg">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[17px] font-semibold">{p.braceletId}</div>
                    <div className="text-xs text-muted">
                      {p.siteName}
                      {p.age != null ? ` · ${p.age} ans` : ""}
                      {" · "}
                      {new Date(p.createdAt).toLocaleTimeString("fr-DZ", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    {p.orientationClass != null ? (
                      <ClassChip klass={p.orientationClass as 1 | 2 | 3} small />
                    ) : (
                      <span className="rounded-md bg-bg px-2 py-1 text-xs text-muted">
                        triage à faire
                      </span>
                    )}
                    {p.scbTotal != null && (
                      <span className="text-xs text-muted">SCB {p.scbTotal} %</span>
                    )}
                    {transferByPatient.get(p.id) && (
                      <span className="text-xs text-muted">
                        transfert : {statusLabel(transferByPatient.get(p.id)!)}
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function statusLabel(s: string): string {
  const map: Record<string, string> = {
    pending: "en cours",
    accepted: "accepté",
    forced: "orienté (régulation)",
    cancelled: "annulé",
    arrived: "arrivé",
    declined: "refusé",
    expired: "expiré",
  };
  return map[s] ?? s;
}
