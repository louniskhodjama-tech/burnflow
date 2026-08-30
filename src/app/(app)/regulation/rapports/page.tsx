import { desc } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { SendReportButton } from "./send-report-button";

export const metadata = { title: "Rapports — Régulation" };
export const dynamic = "force-dynamic";

export default async function RapportsPage() {
  await requireActor("regulateur");

  const recentAudit = await db
    .select()
    .from(auditLog)
    .orderBy(desc(auditLog.id))
    .limit(50);

  return (
    <div className="flex flex-col gap-2 pb-6">
      <h1 className="pt-2 text-lg font-semibold">Rapports et audit</h1>

      <section className="card">
        <h2 className="card-title">Rapport de situation</h2>
        <p className="text-[13px] text-muted">
          Envoyé automatiquement par email aux régulateurs toutes les 6 h
          (chiffres calculés en base, sans IA). Vous pouvez déclencher un envoi
          immédiat :
        </p>
        <SendReportButton />
      </section>

      <section className="card">
        <h2 className="card-title">Journal d&apos;audit</h2>
        <a href="/api/regulation/audit.csv" className="btn-primary mb-2 w-full">
          Exporter tout le journal (CSV)
        </a>
        <div className="overflow-x-auto">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-1 pr-2">Quand</th>
                <th className="pr-2">Rôle</th>
                <th className="pr-2">Action</th>
                <th>Entité</th>
              </tr>
            </thead>
            <tbody>
              {recentAudit.map((a) => (
                <tr key={a.id} className="border-t border-line">
                  <td className="py-1 pr-2 text-muted">
                    {new Date(a.createdAt).toLocaleString("fr-DZ", {
                      day: "2-digit",
                      month: "2-digit",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </td>
                  <td className="pr-2">{a.role ?? "système"}</td>
                  <td className="pr-2 font-mono">{a.action}</td>
                  <td className="text-muted">{a.entityType}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-muted">50 dernières entrées — l&apos;export CSV contient tout.</p>
      </section>
    </div>
  );
}
