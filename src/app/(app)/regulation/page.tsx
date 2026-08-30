import Link from "next/link";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  capacitySnapshots,
  patients,
  sites,
  transferRequests,
} from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { getCurrentRules } from "@/lib/rules";
import { occupancyOf } from "@/lib/routing";
import { ClassChip } from "@/components/class-chip";
import { RegMap, type MapSite } from "@/components/reg-map";

export const metadata = { title: "Régulation — Triage brûlés" };
export const dynamic = "force-dynamic";

export default async function RegulationPage() {
  await requireActor("regulateur");
  const { config } = await getCurrentRules();
  const staleCutoff = new Date(
    Date.now() - config.routing.capacityStaleHours * 3600 * 1000,
  );

  // Demandes en attente, par classe
  const pending = await db
    .select({
      id: transferRequests.id,
      orientationClass: transferRequests.orientationClass,
      exhausted: transferRequests.exhausted,
      currentIndex: transferRequests.currentIndex,
      cascade: transferRequests.cascade,
      createdAt: transferRequests.createdAt,
      braceletId: patients.braceletId,
      patientId: patients.id,
    })
    .from(transferRequests)
    .innerJoin(patients, eq(patients.id, transferRequests.patientId))
    .where(eq(transferRequests.status, "pending"))
    .orderBy(desc(transferRequests.exhausted), transferRequests.createdAt);

  // Capacités courantes par site
  const latest = db
    .selectDistinctOn([capacitySnapshots.siteId], {
      siteId: capacitySnapshots.siteId,
      icu: capacitySnapshots.icuBedsFree,
      ward: capacitySnapshots.wardBedsFree,
      totalIcu: capacitySnapshots.declaredTotalIcu,
      totalWard: capacitySnapshots.declaredTotalWard,
      createdAt: capacitySnapshots.createdAt,
    })
    .from(capacitySnapshots)
    .orderBy(capacitySnapshots.siteId, desc(capacitySnapshots.createdAt))
    .as("latest");

  const allSites = await db
    .select({
      id: sites.id,
      name: sites.name,
      kind: sites.kind,
      wilaya: sites.wilaya,
      lat: sites.lat,
      lng: sites.lng,
      active: sites.active,
      icu: latest.icu,
      ward: latest.ward,
      totalIcu: latest.totalIcu,
      totalWard: latest.totalWard,
      snapAt: latest.createdAt,
    })
    .from(sites)
    .leftJoin(latest, eq(latest.siteId, sites.id))
    .where(eq(sites.active, true));

  const hospitals = allSites
    .filter((s) => s.kind !== "triage_point")
    .map((s) => {
      const stale = !s.snapAt || new Date(s.snapAt) < staleCutoff;
      const occ =
        s.icu != null
          ? occupancyOf({
              freeForType: s.icu,
              declaredTotal: s.totalIcu,
              recentMaxFree: s.icu,
            })
          : null;
      return { ...s, stale, occ };
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const mapSites: MapSite[] = allSites.map((s) => ({
    id: s.id,
    name: s.name,
    kind: s.kind as MapSite["kind"],
    lat: s.lat,
    lng: s.lng,
    icuFree: s.icu,
    wardFree: s.ward,
    stale: s.kind !== "triage_point" && (!s.snapAt || new Date(s.snapAt) < staleCutoff),
  }));

  const countByClass = (k: number) =>
    pending.filter((p) => p.orientationClass === k).length;

  return (
    <div className="flex flex-col gap-2 pb-6">
      <h1 className="pt-2 text-lg font-semibold">Tableau de bord national</h1>

      <div className="grid grid-cols-3 gap-2">
        {[1, 2, 3].map((k) => (
          <div key={k} className="card text-center">
            <div className="text-3xl font-bold tabular-nums">{countByClass(k)}</div>
            <div className="text-xs text-muted">
              en attente
              <br />
              classe {k}
            </div>
          </div>
        ))}
      </div>

      {pending.some((p) => p.exhausted) && (
        <div className="card border-centre">
          <h2 className="card-title">Cascades épuisées — action requise</h2>
          <ul className="flex flex-col gap-1">
            {pending
              .filter((p) => p.exhausted)
              .map((p) => (
                <li key={p.id}>
                  <Link
                    href={`/regulation/demandes/${p.id}`}
                    className="flex items-center justify-between rounded-lg border border-centre bg-centre/5 px-2 py-1.5 text-[14px]"
                  >
                    <span className="font-semibold">{p.braceletId}</span>
                    <ClassChip klass={p.orientationClass as 1 | 2 | 3} small />
                  </Link>
                </li>
              ))}
          </ul>
        </div>
      )}

      <section className="card">
        <h2 className="card-title">Carte</h2>
        <RegMap sites={mapSites} />
        <p className="mt-1 text-xs text-muted">
          Bleu : points médicaux · vert : hôpitaux · rouge : centres des brûlés ·
          gris : capacité périmée.
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">Hôpitaux — occupation et fraîcheur</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-muted">
                <th className="py-1 pr-2">Hôpital</th>
                <th className="px-1 text-center">Réa</th>
                <th className="px-1 text-center">Hosp.</th>
                <th className="px-1 text-center">Occ.</th>
                <th className="px-1 text-right">MàJ</th>
              </tr>
            </thead>
            <tbody>
              {hospitals.map((h) => (
                <tr key={h.id} className="border-t border-line">
                  <td className="py-1.5 pr-2">
                    {h.kind === "burn_center" ? "★ " : ""}
                    {h.name}
                  </td>
                  <td className="px-1 text-center font-semibold tabular-nums">
                    {h.icu ?? "—"}
                  </td>
                  <td className="px-1 text-center tabular-nums">{h.ward ?? "—"}</td>
                  <td className="px-1 text-center tabular-nums">
                    {h.occ != null ? (
                      <span
                        className={
                          h.occ >= config.routing.saturationThreshold
                            ? "font-bold text-centre"
                            : ""
                        }
                      >
                        {Math.round(h.occ * 100)} %
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td
                    className={`px-1 text-right ${h.stale ? "font-semibold text-centre" : "text-muted"}`}
                  >
                    {h.snapAt ? relTime(new Date(h.snapAt)) : "jamais"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">Demandes en attente</h2>
        {pending.length === 0 ? (
          <p className="text-[14px] text-muted">Aucune demande en attente.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {pending.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/regulation/demandes/${p.id}`}
                  className="flex items-center justify-between rounded-lg border border-line px-2 py-1.5 text-[14px] active:bg-bg"
                >
                  <span>
                    <b>{p.braceletId}</b>
                    <span className="text-muted">
                      {" "}
                      — {p.exhausted
                        ? "cascade épuisée"
                        : `${p.cascade[p.currentIndex]?.siteName ?? "?"} (${p.currentIndex + 1}/${p.cascade.length})`}
                    </span>
                  </span>
                  <ClassChip klass={p.orientationClass as 1 | 2 | 3} small />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function relTime(d: Date): string {
  const mins = Math.round((Date.now() - d.getTime()) / 60000);
  if (mins < 60) return `${mins} min`;
  return `${(mins / 60).toFixed(1)} h`;
}
