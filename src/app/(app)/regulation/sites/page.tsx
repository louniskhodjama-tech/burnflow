import { asc } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { SiteRow, NewSiteForm } from "./site-forms";

export const metadata = { title: "Sites — Régulation" };
export const dynamic = "force-dynamic";

export default async function SitesPage() {
  await requireActor("regulateur");
  const rows = await db
    .select()
    .from(sites)
    .orderBy(asc(sites.toVerify), asc(sites.kind), asc(sites.name));

  const toVerify = rows.filter((s) => s.toVerify);
  const verified = rows.filter((s) => !s.toVerify);

  return (
    <div className="flex flex-col gap-2 pb-6">
      <h1 className="pt-2 text-lg font-semibold">Sites</h1>

      {toVerify.length > 0 && (
        <section className="card border-rea">
          <h2 className="card-title">
            À vérifier avant activation ({toVerify.length})
          </h2>
          <p className="mb-2 text-xs text-muted">
            Vérifiez nom, type, coordonnées et téléphone avant de valider. Un
            site non vérifié ne peut pas être activé.
          </p>
          <ul className="flex flex-col gap-2">
            {toVerify.map((s) => (
              <SiteRow key={s.id} site={s} />
            ))}
          </ul>
        </section>
      )}

      <section className="card">
        <h2 className="card-title">Sites vérifiés ({verified.length})</h2>
        <ul className="flex flex-col gap-2">
          {verified.map((s) => (
            <SiteRow key={s.id} site={s} />
          ))}
        </ul>
      </section>

      <NewSiteForm />
    </div>
  );
}
