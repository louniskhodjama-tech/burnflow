import { desc } from "drizzle-orm";
import { db } from "@/db";
import { rulesConfig } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { getCurrentRules } from "@/lib/rules";
import { RulesForm } from "./rules-form";

export const metadata = { title: "Seuils — Régulation" };
export const dynamic = "force-dynamic";

export default async function SeuilsPage() {
  await requireActor("regulateur");
  const { version, config } = await getCurrentRules();
  const history = await db
    .select({
      version: rulesConfig.version,
      comment: rulesConfig.comment,
      createdAt: rulesConfig.createdAt,
    })
    .from(rulesConfig)
    .orderBy(desc(rulesConfig.version))
    .limit(10);

  return (
    <div className="flex flex-col gap-2 pb-6">
      <h1 className="pt-2 text-lg font-semibold">Seuils et paramètres</h1>
      <div className="card">
        <p className="text-[13px] text-muted">
          Version courante : <b className="text-ink">v{version}</b>. Toute
          modification crée une nouvelle version ; les triages et cascades
          passés gardent la référence de leur version d&apos;origine.
        </p>
      </div>
      <RulesForm initial={config} />
      <section className="card">
        <h2 className="card-title">Historique</h2>
        <ul className="flex flex-col gap-1 text-[13px]">
          {history.map((h) => (
            <li key={h.version} className="flex justify-between border-b border-line pb-1 last:border-b-0">
              <span>
                v{h.version}
                {h.comment ? ` — ${h.comment}` : ""}
              </span>
              <span className="text-muted">
                {new Date(h.createdAt).toLocaleString("fr-DZ", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
