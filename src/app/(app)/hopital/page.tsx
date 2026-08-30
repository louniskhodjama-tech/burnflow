import { eq } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { capacityAgeHours, getCurrentCapacity } from "@/lib/capacity";
import { getCurrentRules } from "@/lib/rules";
import { CapacityForm } from "./capacity-form";

export const metadata = { title: "Capacité — Triage brûlés" };
export const dynamic = "force-dynamic";

export default async function HopitalPage() {
  const actor = await requireActor("referent");
  const siteId = actor.siteIds[0];

  if (!siteId) {
    return (
      <div className="card my-2">
        <p className="text-[15px]">
          Aucun hôpital ne vous est affecté. Contactez le régulateur.
        </p>
      </div>
    );
  }

  const site = (
    await db.select().from(sites).where(eq(sites.id, siteId)).limit(1)
  )[0];
  const current = await getCurrentCapacity(siteId);
  const { config } = await getCurrentRules();

  const ageHours = current ? capacityAgeHours(current) : null;
  const stale = ageHours == null || ageHours > config.routing.capacityStaleHours;

  return (
    <div className="pb-6">
      <h1 className="py-2 text-lg font-semibold">{site?.name}</h1>

      <div
        className={`card mb-2 ${stale ? "border-centre" : "border-chir"}`}
      >
        <p className="text-[14px]">
          {current ? (
            <>
              Dernière mise à jour :{" "}
              <b>
                {new Date(current.createdAt).toLocaleString("fr-DZ", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </b>{" "}
              ({ageHours! < 1 ? `${Math.round(ageHours! * 60)} min` : `${ageHours!.toFixed(1)} h`})
              {stale && (
                <span className="font-semibold text-centre">
                  {" "}
                  — PÉRIMÉE (&gt; {config.routing.capacityStaleHours} h) : votre hôpital
                  n&apos;est plus proposé aux transferts.
                </span>
              )}
            </>
          ) : (
            <span className="font-semibold text-centre">
              Capacité jamais saisie — votre hôpital n&apos;est pas proposé aux transferts.
            </span>
          )}
        </p>
      </div>

      <CapacityForm
        siteId={siteId}
        initial={
          current
            ? {
                icuBedsFree: current.icuBedsFree,
                wardBedsFree: current.wardBedsFree,
                orAvailable: current.orAvailable,
                burnSurgeonPresent: current.burnSurgeonPresent,
                suppliesOk: current.suppliesOk,
                note: current.note ?? "",
                declaredTotalIcu: current.declaredTotalIcu,
                declaredTotalWard: current.declaredTotalWard,
              }
            : null
        }
        hasCurrent={!!current}
      />
    </div>
  );
}
