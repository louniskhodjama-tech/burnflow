import Link from "next/link";
import { and, eq, isNotNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { patients, transferRequests } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { ClassChip } from "@/components/class-chip";
import { Countdown } from "@/components/countdown";

export const metadata = { title: "Demandes reçues — Triage brûlés" };
export const dynamic = "force-dynamic";

export default async function DemandesPage() {
  const actor = await requireActor("referent");
  const siteId = actor.siteIds[0];
  if (!siteId) {
    return (
      <div className="card my-2">
        <p className="text-[15px]">Aucun hôpital affecté. Contactez le régulateur.</p>
      </div>
    );
  }

  const rows = await db
    .select({
      id: transferRequests.id,
      orientationClass: transferRequests.orientationClass,
      bedType: transferRequests.bedType,
      hopSentAt: transferRequests.hopSentAt,
      timeoutMinutes: transferRequests.timeoutMinutes,
      currentIndex: transferRequests.currentIndex,
      cascade: transferRequests.cascade,
      braceletId: patients.braceletId,
    })
    .from(transferRequests)
    .innerJoin(patients, eq(patients.id, transferRequests.patientId))
    .where(
      and(
        eq(transferRequests.status, "pending"),
        isNotNull(transferRequests.hopSentAt),
        sql`${transferRequests.cascade}->${transferRequests.currentIndex}->>'siteId' = ${siteId}`,
      ),
    )
    .orderBy(transferRequests.hopSentAt);

  return (
    <div className="pb-4">
      <h1 className="py-2 text-lg font-semibold">Demandes adressées à mon hôpital</h1>
      {rows.length === 0 ? (
        <div className="card">
          <p className="text-[15px] text-muted">
            Aucune demande en attente. Vous serez notifié à la prochaine.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const deadline = new Date(
              new Date(r.hopSentAt!).getTime() + r.timeoutMinutes * 60_000,
            ).toISOString();
            return (
              <li key={r.id}>
                <Link href={`/hopital/demandes/${r.id}`} className="card block active:bg-bg">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <div className="text-[17px] font-semibold">{r.braceletId}</div>
                      <div className="text-xs text-muted">
                        Lit demandé : {bedLabel(r.bedType)}
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <ClassChip klass={r.orientationClass as 1 | 2 | 3} small />
                      <span className="text-[13px]">
                        <Countdown deadline={deadline} />
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function bedLabel(b: string): string {
  return b === "ward" ? "hospitalisation" : b === "icu" ? "réanimation" : "centre des brûlés";
}
