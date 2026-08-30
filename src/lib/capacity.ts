import "server-only";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { capacitySnapshots } from "@/db/schema";

export type CapacityRow = typeof capacitySnapshots.$inferSelect;

/** Capacité courante = dernier snapshot du site (null si jamais saisie). */
export async function getCurrentCapacity(
  siteId: string,
): Promise<CapacityRow | null> {
  const row = (
    await db
      .select()
      .from(capacitySnapshots)
      .where(eq(capacitySnapshots.siteId, siteId))
      .orderBy(desc(capacitySnapshots.createdAt))
      .limit(1)
  )[0];
  return row ?? null;
}

export function capacityAgeHours(snapshot: CapacityRow): number {
  return (Date.now() - new Date(snapshot.createdAt).getTime()) / 3_600_000;
}

export function isCapacityStale(
  snapshot: CapacityRow | null,
  staleHours: number,
): boolean {
  if (!snapshot) return true;
  return capacityAgeHours(snapshot) > staleHours;
}
