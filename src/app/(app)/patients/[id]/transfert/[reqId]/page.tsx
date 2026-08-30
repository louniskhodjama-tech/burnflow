import Link from "next/link";
import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sites, transferEvents, transferRequests } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { can } from "@/lib/policy";
import { getPatientForActor } from "@/lib/patients";
import { ClassChip } from "@/components/class-chip";
import { Countdown } from "@/components/countdown";
import { CancelTransferButton } from "./cancel-button";

export const dynamic = "force-dynamic";

export default async function TransferStatusPage({
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
  if (
    !can.viewTransferRequest(actor, {
      patientTriageSiteId: found.patient.siteId,
      currentHopSiteId: req.cascade[req.currentIndex]?.siteId ?? null,
      acceptedBySiteId: req.acceptedBySiteId,
    })
  )
    notFound();

  const accepted = req.acceptedBySiteId
    ? (
        await db.select().from(sites).where(eq(sites.id, req.acceptedBySiteId)).limit(1)
      )[0]
    : null;

  const events = await db
    .select()
    .from(transferEvents)
    .where(eq(transferEvents.requestId, reqId))
    .orderBy(transferEvents.createdAt, transferEvents.id);

  const deadline =
    req.status === "pending" && req.hopSentAt
      ? new Date(
          new Date(req.hopSentAt).getTime() + req.timeoutMinutes * 60_000,
        ).toISOString()
      : null;

  const isUrgentiste = actor.role === "urgentiste";

  return (
    <div className="flex flex-col gap-2 pb-6">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-lg font-semibold">
          Transfert — {found.patient.braceletId}
        </h1>
        <ClassChip klass={req.orientationClass as 1 | 2 | 3} small />
      </div>

      {req.status === "pending" && !req.exhausted && (
        <section className="card border-rea">
          <h2 className="card-title">Recherche en cours</h2>
          <p className="text-[15px]">
            Hôpital sollicité :{" "}
            <b>{req.cascade[req.currentIndex]?.siteName ?? "—"}</b>
            {" "}({req.currentIndex + 1}/{req.cascade.length})
          </p>
          {deadline && (
            <p className="mt-1 text-[15px]">
              Réponse attendue avant : <Countdown deadline={deadline} />
            </p>
          )}
        </section>
      )}

      {req.status === "pending" && req.exhausted && (
        <section className="card border-centre">
          <h2 className="card-title">Cascade épuisée</h2>
          <p className="text-[15px]">
            Aucun hôpital n&apos;a accepté. <b>Le régulateur est alerté</b> et va
            orienter le patient manuellement. Gardez le patient conditionné.
          </p>
        </section>
      )}

      {(req.status === "accepted" || req.status === "forced") && accepted && (
        <section className="card border-chir">
          <h2 className="card-title">
            {req.status === "forced" ? "Destination fixée par la régulation" : "Hôpital d'accueil confirmé"}
          </h2>
          <p className="text-xl font-bold">{accepted.name}</p>
          <p className="text-[15px] text-muted">{accepted.wilaya}</p>
          {accepted.phone && (
            <a href={`tel:${accepted.phone.replace(/\s/g, "")}`} className="btn-primary mt-2 w-full">
              Appeler le service : {accepted.phone}
            </a>
          )}
        </section>
      )}

      {req.status === "arrived" && (
        <section className="card border-chir">
          <p className="text-[15px]">
            Patient <b>arrivé</b> à {accepted?.name ?? "destination"}
            {req.arrivedAt
              ? ` le ${new Date(req.arrivedAt).toLocaleString("fr-DZ")}`
              : ""}
            .
          </p>
        </section>
      )}

      {req.status === "cancelled" && (
        <section className="card">
          <p className="text-[15px] text-muted">Demande annulée.</p>
        </section>
      )}

      {/* Cascade visible : noms et progression (pas de capacités pour l'urgentiste) */}
      <section className="card">
        <h2 className="card-title">Cascade</h2>
        <ol className="flex flex-col gap-1">
          {req.cascade.map((c, i) => {
            const state =
              req.status !== "pending" && req.acceptedBySiteId === c.siteId
                ? "accepté"
                : i < req.currentIndex
                  ? "passé"
                  : i === req.currentIndex && req.status === "pending" && !req.exhausted
                    ? "en attente"
                    : "";
            return (
              <li
                key={c.siteId}
                className={`flex items-center justify-between rounded-lg border px-2 py-1.5 text-[14px] ${
                  state === "en attente"
                    ? "border-rea bg-rea/5"
                    : state === "accepté"
                      ? "border-chir bg-chir/5"
                      : "border-line"
                }`}
              >
                <span>
                  {i + 1}. {c.siteName}
                </span>
                <span className="text-xs text-muted">
                  ~{Math.round(c.minutes)} min
                  {c.distanceSource === "estimate" ? " (estimé)" : ""}
                  {state ? ` · ${state}` : ""}
                </span>
              </li>
            );
          })}
          {req.cascade.length === 0 && (
            <li className="text-[14px] text-muted">Aucun hôpital candidat au moment de la demande.</li>
          )}
        </ol>
      </section>

      <section className="card">
        <h2 className="card-title">Journal</h2>
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
                })}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex gap-2">
        <Link
          href={`/patients/${id}/transfert/${reqId}/imprimer`}
          className="btn-base flex-1"
        >
          Fiche de transfert (imprimer / PDF)
        </Link>
        {isUrgentiste && ["pending", "accepted", "forced"].includes(req.status) && (
          <CancelTransferButton patientId={id} requestId={reqId} />
        )}
      </div>
    </div>
  );
}

function eventLabel(t: string): string {
  const map: Record<string, string> = {
    created: "Demande créée",
    sent: "Envoyée à l'hôpital",
    declined: "Refusée",
    expired: "Expirée (sans réponse)",
    accepted: "Acceptée — lit réservé",
    forced: "Destination forcée par la régulation",
    reassigned: "Réservation précédente libérée",
    cancelled: "Annulée",
    arrived: "Patient arrivé",
    exhausted: "Cascade épuisée — régulateur alerté",
  };
  return map[t] ?? t;
}
