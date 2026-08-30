import Link from "next/link";
import { and, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { patients, transferRequests } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { ClassChip } from "@/components/class-chip";
import { ArrivedButton } from "./arrived-button";

export const metadata = { title: "Patients attendus — Triage brûlés" };
export const dynamic = "force-dynamic";

export default async function AttendusPage() {
  const actor = await requireActor("referent");
  const siteId = actor.siteIds[0];
  if (!siteId) {
    return (
      <div className="card my-2">
        <p className="text-[15px]">Aucun hôpital affecté.</p>
      </div>
    );
  }

  const expected = await db
    .select({
      id: transferRequests.id,
      status: transferRequests.status,
      orientationClass: transferRequests.orientationClass,
      acceptedAt: transferRequests.acceptedAt,
      patientId: patients.id,
      braceletId: patients.braceletId,
      age: patients.age,
    })
    .from(transferRequests)
    .innerJoin(patients, eq(patients.id, transferRequests.patientId))
    .where(
      and(
        eq(transferRequests.acceptedBySiteId, siteId),
        inArray(transferRequests.status, ["accepted", "forced"]),
      ),
    )
    .orderBy(transferRequests.acceptedAt);

  const arrived = await db
    .select({
      id: transferRequests.id,
      arrivedAt: transferRequests.arrivedAt,
      braceletId: patients.braceletId,
      patientId: patients.id,
    })
    .from(transferRequests)
    .innerJoin(patients, eq(patients.id, transferRequests.patientId))
    .where(
      and(
        eq(transferRequests.acceptedBySiteId, siteId),
        eq(transferRequests.status, "arrived"),
      ),
    )
    .orderBy(desc(transferRequests.arrivedAt))
    .limit(20);

  return (
    <div className="pb-4">
      <h1 className="py-2 text-lg font-semibold">Patients attendus</h1>
      {expected.length === 0 ? (
        <div className="card">
          <p className="text-[15px] text-muted">Aucun patient en route.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {expected.map((r) => (
            <li key={r.id} className="card">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <Link href={`/patients/${r.patientId}`} className="text-[17px] font-semibold underline underline-offset-4">
                    {r.braceletId}
                  </Link>
                  <div className="text-xs text-muted">
                    {r.age != null ? `${Number(r.age)} ans · ` : ""}
                    {r.status === "forced" ? "orienté par la régulation · " : ""}
                    accepté à{" "}
                    {r.acceptedAt
                      ? new Date(r.acceptedAt).toLocaleTimeString("fr-DZ", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : "—"}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <ClassChip klass={r.orientationClass as 1 | 2 | 3} small />
                  <ArrivedButton requestId={r.id} />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {arrived.length > 0 && (
        <>
          <h2 className="pb-1 pt-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Arrivés récemment
          </h2>
          <ul className="flex flex-col gap-1">
            {arrived.map((r) => (
              <li key={r.id} className="card py-2">
                <div className="flex items-center justify-between text-[14px]">
                  <Link href={`/patients/${r.patientId}`} className="font-medium underline underline-offset-4">
                    {r.braceletId}
                  </Link>
                  <span className="text-xs text-muted">
                    {r.arrivedAt
                      ? new Date(r.arrivedAt).toLocaleString("fr-DZ", {
                          day: "2-digit",
                          month: "2-digit",
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
