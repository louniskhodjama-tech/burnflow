import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { sites } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { createPatient } from "../actions";

export const metadata = { title: "Nouveau patient — Triage brûlés" };

export default async function NewPatientPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const actor = await requireActor("urgentiste");
  const { error } = await searchParams;

  const mySites = actor.siteIds.length
    ? await db
        .select({ id: sites.id, name: sites.name })
        .from(sites)
        .where(inArray(sites.id, actor.siteIds))
    : [];

  return (
    <div className="pb-6">
      <h1 className="py-2 text-lg font-semibold">Nouveau patient</h1>

      {error === "bracelet" && (
        <div className="card my-2 border-centre">
          <p className="text-centre text-[15px]">
            Cet ID bracelet existe déjà sur ce site. Vérifiez le bracelet ou
            retrouvez le patient dans la liste.
          </p>
        </div>
      )}
      {error === "champs" && (
        <div className="card my-2 border-centre">
          <p className="text-centre text-[15px]">Formulaire incomplet ou invalide.</p>
        </div>
      )}

      <form action={createPatient} className="flex flex-col gap-2">
        <section className="card">
          <h2 className="card-title">Identification (pseudonymisée)</h2>
          <div className="flex flex-col gap-2">
            {mySites.length > 1 ? (
              <div>
                <label className="field-label" htmlFor="siteId">
                  Point médical
                </label>
                <select className="input-base" id="siteId" name="siteId" required>
                  {mySites.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <input type="hidden" name="siteId" value={mySites[0]?.id ?? ""} />
            )}
            <div>
              <label className="field-label" htmlFor="braceletId">
                ID bracelet — jamais de nom ni de téléphone
              </label>
              <input
                className="input-base"
                id="braceletId"
                name="braceletId"
                placeholder="JJ-0042"
                autoComplete="off"
                required
              />
            </div>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Patient</h2>
          <div className="flex flex-wrap gap-2">
            <div className="min-w-[110px] flex-1">
              <label className="field-label" htmlFor="age">
                Âge (ans)
              </label>
              <input className="input-base" id="age" name="age" type="number" inputMode="decimal" min={0} max={120} step="0.5" placeholder="34" />
            </div>
            <div className="min-w-[110px] flex-1">
              <label className="field-label" htmlFor="weightKg">
                Poids est. (kg)
              </label>
              <input className="input-base" id="weightKg" name="weightKg" type="number" inputMode="decimal" min={1} max={250} placeholder="70" />
            </div>
            <div className="min-w-[110px] flex-1">
              <label className="field-label" htmlFor="hoursSinceBurn">
                Délai (h)
              </label>
              <input className="input-base" id="hoursSinceBurn" name="hoursSinceBurn" type="number" inputMode="decimal" min={0} max={96} step="0.5" placeholder="2" />
            </div>
          </div>
          <div className="mt-2">
            <label className="field-label" htmlFor="mechanism">
              Mécanisme
            </label>
            <select className="input-base" id="mechanism" name="mechanism" defaultValue="flamme">
              <option value="flamme">Flamme</option>
              <option value="contact">Contact / chaleur</option>
              <option value="elec">Électrique</option>
              <option value="chim">Chimique</option>
            </select>
          </div>
        </section>

        <section className="card">
          <h2 className="card-title">Autres éléments</h2>
          <div className="flex flex-col">
            <Flag name="inhalation" label="Inhalation suspectée" />
            <Flag name="closedSpace" label="Incendie en espace clos" />
            <Flag name="trauma" label="Lésion traumatique associée" />
            <Flag name="comorbidity" label="Comorbidité significative" last />
          </div>
        </section>

        <button className="btn-primary" type="submit">
          Créer et passer au triage
        </button>
      </form>
    </div>
  );
}

function Flag({ name, label, last }: { name: string; label: string; last?: boolean }) {
  return (
    <label
      className={`flex min-h-11 items-center gap-2.5 text-[15px] ${
        last ? "" : "border-b border-line"
      }`}
    >
      <input type="checkbox" name={name} className="h-5.5 w-5.5 min-h-0" />
      {label}
    </label>
  );
}
