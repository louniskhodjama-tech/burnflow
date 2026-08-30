import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { patients, sites, transferRequests } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { ClassChip } from "@/components/class-chip";

export const metadata = { title: "Demandes — Régulation" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  pending: "en cours",
  accepted: "acceptée",
  forced: "forcée",
  cancelled: "annulée",
  arrived: "arrivée",
  declined: "refusée",
  expired: "expirée",
};

export default async function RegDemandesPage() {
  await requireActor("regulateur");

  const rows = await db
    .select({
      id: transferRequests.id,
      status: transferRequests.status,
      exhausted: transferRequests.exhausted,
      orientationClass: transferRequests.orientationClass,
      currentIndex: transferRequests.currentIndex,
      cascade: transferRequests.cascade,
      createdAt: transferRequests.createdAt,
      braceletId: patients.braceletId,
      acceptedName: sites.name,
    })
    .from(transferRequests)
    .innerJoin(patients, eq(patients.id, transferRequests.patientId))
    .leftJoin(sites, eq(sites.id, transferRequests.acceptedBySiteId))
    .orderBy(desc(transferRequests.createdAt))
    .limit(200);

  return (
    <div className="pb-4">
      <h1 className="py-2 text-lg font-semibold">Toutes les demandes</h1>
      {rows.length === 0 ? (
        <div className="card">
          <p className="text-[15px] text-muted">Aucune demande.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link
                href={`/regulation/demandes/${r.id}`}
                className={`card block active:bg-bg ${r.exhausted && r.status === "pending" ? "border-centre" : ""}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="text-[16px] font-semibold">{r.braceletId}</div>
                    <div className="text-xs text-muted">
                      {STATUS_LABELS[r.status] ?? r.status}
                      {r.status === "pending" && !r.exhausted
                        ? ` — ${r.cascade[r.currentIndex]?.siteName ?? "?"} (${r.currentIndex + 1}/${r.cascade.length})`
                        : ""}
                      {r.status === "pending" && r.exhausted ? " — cascade épuisée" : ""}
                      {r.acceptedName ? ` — ${r.acceptedName}` : ""}
                      {" · "}
                      {new Date(r.createdAt).toLocaleString("fr-DZ", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                  <ClassChip klass={r.orientationClass as 1 | 2 | 3} small />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
