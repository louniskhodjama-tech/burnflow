import Link from "next/link";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { adviceRequests, assessments, patients } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { ClassChip } from "@/components/class-chip";

export const metadata = { title: "File des avis — Triage brûlés" };
export const dynamic = "force-dynamic";

export default async function AvisQueuePage() {
  await requireActor("brulologue");

  const rows = await db
    .select({
      id: adviceRequests.id,
      question: adviceRequests.question,
      createdAt: adviceRequests.createdAt,
      braceletId: patients.braceletId,
      age: patients.age,
      scbTotal: assessments.scbTotal,
      orientationClass: assessments.orientationClass,
    })
    .from(adviceRequests)
    .innerJoin(patients, eq(patients.id, adviceRequests.patientId))
    .leftJoin(assessments, eq(assessments.id, adviceRequests.assessmentId))
    .where(inArray(adviceRequests.status, ["open", "released"]))
    .orderBy(adviceRequests.createdAt);

  return (
    <div className="pb-4">
      <h1 className="py-2 text-lg font-semibold">File des demandes d&apos;avis</h1>
      <p className="pb-2 text-[13px] text-muted">
        Les plus anciennes d&apos;abord. Prendre une demande la retire de la file
        des autres brûlologues.
      </p>
      {rows.length === 0 ? (
        <div className="card">
          <p className="text-[15px] text-muted">Aucune demande en attente.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((r) => (
            <li key={r.id}>
              <Link href={`/avis/${r.id}`} className="card block active:bg-bg">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-[15px] font-semibold">
                      {r.braceletId}
                      {r.age != null ? ` · ${r.age} ans` : ""}
                      {r.scbTotal != null ? ` · SCB ${r.scbTotal} %` : ""}
                    </div>
                    <p className="mt-0.5 truncate text-[13px] text-muted">{r.question}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    {r.orientationClass != null && (
                      <ClassChip klass={r.orientationClass as 1 | 2 | 3} small />
                    )}
                    <span className="text-xs text-muted">
                      {new Date(r.createdAt).toLocaleTimeString("fr-DZ", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
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
