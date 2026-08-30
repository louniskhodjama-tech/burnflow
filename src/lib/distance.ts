import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { distanceCache, sites } from "@/db/schema";

/**
 * Distances inter-sites (DECISIONS D-004) :
 * - OSRM self-hosted (profil car) quand OSRM_URL répond ;
 * - sinon estimation haversine × 1,35 à 70 km/h, marquée source='estimate',
 *   recalculée en 'osrm' par `pnpm distances:rebuild` dès qu'OSRM est disponible.
 */

const ROAD_FACTOR = 1.35;
const AVG_KMH = 70;

export function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) *
      Math.cos((bLat * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

export function estimateRoute(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): { minutes: number; km: number } {
  const km = haversineKm(aLat, aLng, bLat, bLng) * ROAD_FACTOR;
  return { km: Math.round(km * 10) / 10, minutes: Math.round((km / AVG_KMH) * 60) };
}

export async function osrmRoute(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): Promise<{ minutes: number; km: number } | null> {
  const base = process.env.OSRM_URL;
  if (!base) return null;
  try {
    const url = `${base}/route/v1/driving/${aLng},${aLat};${bLng},${bLat}?overview=false`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      code?: string;
      routes?: { duration: number; distance: number }[];
    };
    const route = json.routes?.[0];
    if (json.code !== "Ok" || !route) return null;
    return {
      minutes: Math.round((route.duration / 60) * 10) / 10,
      km: Math.round((route.distance / 1000) * 10) / 10,
    };
  } catch {
    return null;
  }
}

export type DistanceResult = {
  minutes: number;
  km: number;
  source: "osrm" | "estimate";
};

/** Distance from→to, servie depuis le cache, calculée et mise en cache sinon. */
export async function getDistances(
  fromSiteId: string,
  toSiteIds: string[],
): Promise<Map<string, DistanceResult>> {
  const out = new Map<string, DistanceResult>();
  if (toSiteIds.length === 0) return out;

  const cached = await db
    .select()
    .from(distanceCache)
    .where(
      and(
        eq(distanceCache.fromSiteId, fromSiteId),
        inArray(distanceCache.toSiteId, toSiteIds),
      ),
    );
  for (const c of cached) {
    out.set(c.toSiteId, {
      minutes: Number(c.minutes),
      km: Number(c.km),
      source: c.source,
    });
  }

  const missing = toSiteIds.filter((id) => !out.has(id));
  if (missing.length === 0) return out;

  const coords = await db
    .select({ id: sites.id, lat: sites.lat, lng: sites.lng })
    .from(sites)
    .where(inArray(sites.id, [fromSiteId, ...missing]));
  const byId = new Map(coords.map((c) => [c.id, c]));
  const from = byId.get(fromSiteId);
  if (!from) return out;

  for (const toId of missing) {
    const to = byId.get(toId);
    if (!to) continue;
    const viaOsrm = await osrmRoute(from.lat, from.lng, to.lat, to.lng);
    const result: DistanceResult = viaOsrm
      ? { ...viaOsrm, source: "osrm" }
      : { ...estimateRoute(from.lat, from.lng, to.lat, to.lng), source: "estimate" };
    out.set(toId, result);
    await db
      .insert(distanceCache)
      .values({
        fromSiteId,
        toSiteId: toId,
        minutes: result.minutes.toString(),
        km: result.km.toString(),
        source: result.source,
      })
      .onConflictDoUpdate({
        target: [distanceCache.fromSiteId, distanceCache.toSiteId],
        set: {
          minutes: result.minutes.toString(),
          km: result.km.toString(),
          source: result.source,
          computedAt: new Date(),
        },
      });
  }
  return out;
}

/**
 * Recalcule la table complète des couples utiles :
 * point médical → hôpital/centre et hôpital → hôpital (GOAL §Stack).
 */
export async function rebuildAllDistances(opts?: {
  onlyEstimates?: boolean;
  log?: (msg: string) => void;
}): Promise<{ computed: number; osrm: number; estimates: number }> {
  const log = opts?.log ?? (() => {});
  const all = await db
    .select({ id: sites.id, kind: sites.kind, lat: sites.lat, lng: sites.lng })
    .from(sites)
    .where(eq(sites.active, true));

  const froms = all; // tous kinds : PM→H et H→H (les PM comme destination sont ignorés)
  const targets = all.filter((s) => s.kind !== "triage_point");
  let computed = 0;
  let viaOsrm = 0;
  let viaEstimate = 0;

  for (const from of froms) {
    for (const to of targets) {
      if (from.id === to.id) continue;
      if (opts?.onlyEstimates) {
        const existing = (
          await db
            .select({ source: distanceCache.source })
            .from(distanceCache)
            .where(
              and(
                eq(distanceCache.fromSiteId, from.id),
                eq(distanceCache.toSiteId, to.id),
              ),
            )
            .limit(1)
        )[0];
        if (existing?.source === "osrm") continue;
      }
      const route = await osrmRoute(from.lat, from.lng, to.lat, to.lng);
      const result: DistanceResult = route
        ? { ...route, source: "osrm" }
        : { ...estimateRoute(from.lat, from.lng, to.lat, to.lng), source: "estimate" };
      await db
        .insert(distanceCache)
        .values({
          fromSiteId: from.id,
          toSiteId: to.id,
          minutes: result.minutes.toString(),
          km: result.km.toString(),
          source: result.source,
        })
        .onConflictDoUpdate({
          target: [distanceCache.fromSiteId, distanceCache.toSiteId],
          set: {
            minutes: result.minutes.toString(),
            km: result.km.toString(),
            source: result.source,
            computedAt: new Date(),
          },
        });
      computed++;
      if (result.source === "osrm") viaOsrm++;
      else viaEstimate++;
    }
    log(`distances depuis ${from.id} : ok`);
  }
  return { computed, osrm: viaOsrm, estimates: viaEstimate };
}
