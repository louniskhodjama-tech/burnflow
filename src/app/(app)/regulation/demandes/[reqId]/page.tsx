import { notFound } from "next/navigation";
import Link from "next/link";
import { and, desc, eq, gt, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  assessments,
  capacitySnapshots,
  patients,
  sites,
  transferEvents,
  transferRequests,
} from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { getCurrentRules } from "@/lib/rules";
import { ClassChip } from "@/components/class-chip";
import { Countdown } from "@/components/countdown";
import { ForcePanel } from "./force-panel";

export const dynamic = "force-dynamic";

export default async function RegDemandeDetailPage({
  params,
}: {
  params: Promise<{ reqId: string }>;
}) {
  await requireActor("regulateur");
  const { reqId } = await params;

  const req = (
    await db
      .select()
      .from(transferRequests)
      .where(eq(transferRequests.id, reqId))
      .limit(1)
  )[0];
  if (!req) notFound();

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
  const events = await db
    .select()
    .from(transferEvents)
    .where(eq(transferEvents.requestId, reqId))
    .orderBy(transferEvents.createdAt, transferEvents.id);
  const accepted = req.acceptedBySiteId
    ? (
        await db.select().from(sites).where(eq(sites.id, req.acceptedBySiteId)).limit(1)
      )[0]
    : null;

  // Cibles possibles pour un forçage : hôpitaux/centres actifs + capacité courante
  const { config } = await getCurrentRules();
  const staleCutoff = new Date(
    Date.now() - config.routing.capacityStaleHours * 3600 * 1000,
  );
  const latest = db
    .selectDistinctOn([capacitySnapshots.siteId], {
      siteId: capacitySnapshots.siteId,
      icu: capacitySnapshots.icuBedsFree,
      ward: capacitySnapshots.wardBedsFree,
      createdAt: capacitySnapshots.createdAt,
    })
    .from(capacitySnapshots)
    .orderBy(capacitySnapshots.siteId, desc(capacitySnapshots.createdAt))
    .as("latest");
  const targets = await db
    .select({
      id: sites.id,
      name: sites.name,
      kind: sites.kind,
      icu: latest.icu,
      ward: latest.ward,
      snapAt: latest.createdAt,
    })
    .from(sites)
    .leftJoin(latest, eq(latest.siteId, sites.id))
    .where(and(eq(sites.active, true), inArray(sites.kind, ["hospital", "burn_center"])));

  const deadline =
    req.status === "pending" && req.hopSentAt
      ? new Date(
          new Date(req.hopSentAt).getTime() + req.timeoutMinutes * 60_000,
        ).toISOString()
      : null;

  return (
    <div className="flex flex-col gap-2 pb-6">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-semibold">Demande — {patient.braceletId}</h1>
        <ClassChip klass={req.orientationClass as 1 | 2 | 3} />
      </div>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-2 text-[14px]">
          <span>
            Statut : <b>{statusLabel(req.status, req.exhausted)}</b>
            {accepted ? ` — ${accepted.name}` : ""}
          </span>
          {deadline && (
            <span>
              Échéance du hop : <Countdown deadline={deadline} />
            </span>
          )}
        </div>
        <p className="mt-1 text-[13px] text-muted">
          SCB {assessment.scbTotal} % (profond {assessment.scbDeep} %) · lit :{" "}
          {req.bedType === "ward" ? "hospitalisation" : req.bedType === "icu" ? "réanimation" : "centre des brûlés"}
          {" · "}règles v{req.rulesVersion} ·{" "}
          <Link className="underline" href={`/patients/${patient.id}`}>
            fiche patient
          </Link>
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">Cascade (figée à la création)</h2>
        <ol className="flex flex-col gap-1">
          {req.cascade.map((c, i) => (
            <li
              key={c.siteId}
              className={`flex items-center justify-between rounded-lg border px-2 py-1.5 text-[13px] ${
                i === req.currentIndex && req.status === "pending" && !req.exhausted
                  ? "border-rea bg-rea/5"
                  : req.acceptedBySiteId === c.siteId
                    ? "border-chir bg-chir/5"
                    : "border-line"
              }`}
            >
              <span>
                {i + 1}. {c.siteName}
              </span>
              <span className="text-xs text-muted">
                {Math.round(c.minutes)} min · occ {Math.round(c.occupancy * 100)} % ·
                score {c.score}
                {c.distanceSource === "estimate" ? " · estimé" : ""}
              </span>
            </li>
          ))}
          {req.cascade.length === 0 && (
            <li className="text-[13px] text-muted">Cascade vide à la création.</li>
          )}
        </ol>
      </section>

      <ForcePanel
        requestId={req.id}
        status={req.status}
        targets={targets.map((t) => ({
          id: t.id,
          label: `${t.kind === "burn_center" ? "★ " : ""}${t.name} — réa ${t.icu ?? "?"} · hosp. ${t.ward ?? "?"}${!t.snapAt || new Date(t.snapAt) < staleCutoff ? " (périmée)" : ""}`,
        }))}
      />

      <section className="card">
        <h2 className="card-title">Journal complet</h2>
        <ul className="flex flex-col gap-1 text-[13px]">
          {events.map((e) => (
            <li key={e.id} className="flex justify-between gap-2 border-b border-line pb-1 last:border-b-0">
              <span>
                {eventLabel(e.type)}
                {e.reason ? ` — ${e.reason}` : ""}
              </span>
              <span className="shrink-0 text-muted">
                {new Date(e.createdAt).toLocaleTimeString("fr-DZ", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                })}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function statusLabel(s: string, exhausted: boolean): string {
  if (s === "pending") return exhausted ? "en attente — cascade épuisée" : "en cours";
  const map: Record<string, string> = {
    accepted: "acceptée",
    forced: "forcée",
    cancelled: "annulée",
    arrived: "arrivée",
  };
  return map[s] ?? s;
}

function eventLabel(t: string): string {
  const map: Record<string, string> = {
    created: "Créée",
    sent: "Envoyée",
    declined: "Refusée",
    expired: "Expirée",
    accepted: "Acceptée (lit réservé)",
    forced: "Forcée",
    reassigned: "Réservation libérée",
    cancelled: "Annulée",
    arrived: "Arrivée",
    exhausted: "Cascade épuisée",
  };
  return map[t] ?? t;
}
