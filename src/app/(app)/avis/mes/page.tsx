import Link from "next/link";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { adviceRequests, patients } from "@/db/schema";
import { requireActor } from "@/lib/auth";

export const metadata = { title: "Mes avis — Triage brûlés" };
export const dynamic = "force-dynamic";

export default async function MesAvisPage() {
  const actor = await requireActor("brulologue");

  const claimed = await db
    .select({
      id: adviceRequests.id,
      question: adviceRequests.question,
      claimedAt: adviceRequests.claimedAt,
      braceletId: patients.braceletId,
    })
    .from(adviceRequests)
    .innerJoin(patients, eq(patients.id, adviceRequests.patientId))
    .where(eq(adviceRequests.claimedBy, actor.userId))
    .orderBy(desc(adviceRequests.claimedAt));

  const answered = await db
    .select({
      id: adviceRequests.id,
      question: adviceRequests.question,
      answeredAt: adviceRequests.answeredAt,
      braceletId: patients.braceletId,
    })
    .from(adviceRequests)
    .innerJoin(patients, eq(patients.id, adviceRequests.patientId))
    .where(eq(adviceRequests.answeredBy, actor.userId))
    .orderBy(desc(adviceRequests.answeredAt))
    .limit(30);

  return (
    <div className="pb-4">
      <h1 className="py-2 text-lg font-semibold">Avis pris par moi</h1>
      {claimed.length === 0 ? (
        <div className="card">
          <p className="text-[15px] text-muted">
            Aucun avis en cours. Prenez-en un dans la file.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {claimed.map((r) => (
            <li key={r.id}>
              <Link href={`/avis/${r.id}`} className="card block border-rea active:bg-bg">
                <div className="text-[15px] font-semibold">{r.braceletId}</div>
                <p className="truncate text-[13px] text-muted">{r.question}</p>
                <p className="mt-1 text-xs text-rea">
                  À répondre — pris à{" "}
                  {r.claimedAt
                    ? new Date(r.claimedAt).toLocaleTimeString("fr-DZ", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })
                    : ""}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {answered.length > 0 && (
        <>
          <h2 className="pb-1 pt-4 text-sm font-semibold uppercase tracking-wide text-muted">
            Répondus
          </h2>
          <ul className="flex flex-col gap-1">
            {answered.map((r) => (
              <li key={r.id}>
                <Link href={`/avis/${r.id}`} className="card block py-2 active:bg-bg">
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="font-medium">{r.braceletId}</span>
                    <span className="text-xs text-muted">
                      {r.answeredAt
                        ? new Date(r.answeredAt).toLocaleString("fr-DZ", {
                            day: "2-digit",
                            month: "2-digit",
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : ""}
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
