/**
 * Rate-limit en mémoire, fenêtre glissante (DECISIONS D-006).
 * Suffisant pour un déploiement mono-instance.
 */

type Entry = { timestamps: number[] };

const buckets = new Map<string, Entry>();

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 10;

export function rateLimitOk(key: string, max = MAX_ATTEMPTS): boolean {
  const now = Date.now();
  const entry = buckets.get(key) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);
  if (entry.timestamps.length >= max) {
    buckets.set(key, entry);
    return false;
  }
  entry.timestamps.push(now);
  buckets.set(key, entry);
  // nettoyage opportuniste
  if (buckets.size > 10_000) {
    for (const [k, e] of buckets) {
      if (e.timestamps.every((t) => now - t >= WINDOW_MS)) buckets.delete(k);
    }
  }
  return true;
}
