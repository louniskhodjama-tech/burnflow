"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/db";
import { capacitySnapshots } from "@/db/schema";
import { clientIp, requireActor } from "@/lib/auth";
import { can } from "@/lib/policy";
import { audit } from "@/lib/audit";
import { getCurrentCapacity } from "@/lib/capacity";

const capacitySchema = z.object({
  siteId: z.string().uuid(),
  icuBedsFree: z.number().int().min(0).max(999),
  wardBedsFree: z.number().int().min(0).max(9999),
  orAvailable: z.boolean(),
  burnSurgeonPresent: z.boolean(),
  suppliesOk: z.boolean(),
  note: z.string().max(500).nullable(),
  declaredTotalIcu: z.number().int().min(0).max(999).nullable(),
  declaredTotalWard: z.number().int().min(0).max(9999).nullable(),
});

export async function submitCapacity(
  payload: z.infer<typeof capacitySchema>,
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireActor("referent", "regulateur");
  const parsed = capacitySchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Valeurs invalides." };
  const data = parsed.data;

  if (!can.updateCapacity(actor, data.siteId))
    return { ok: false, error: "Accès refusé pour cet hôpital." };

  const before = await getCurrentCapacity(data.siteId);

  await db.insert(capacitySnapshots).values({
    siteId: data.siteId,
    icuBedsFree: data.icuBedsFree,
    wardBedsFree: data.wardBedsFree,
    orAvailable: data.orAvailable,
    burnSurgeonPresent: data.burnSurgeonPresent,
    suppliesOk: data.suppliesOk,
    note: data.note,
    declaredTotalIcu: data.declaredTotalIcu,
    declaredTotalWard: data.declaredTotalWard,
    createdBy: actor.userId,
  });

  await audit({
    userId: actor.userId,
    role: actor.role,
    action: "capacity.update",
    entityType: "site",
    entityId: data.siteId,
    before: before
      ? { icu: before.icuBedsFree, ward: before.wardBedsFree }
      : null,
    after: { icu: data.icuBedsFree, ward: data.wardBedsFree },
    ip: await clientIp(),
  });

  revalidatePath("/hopital");
  return { ok: true };
}

/** « Confirmer inchangé » : nouveau snapshot identique, horodatage frais. */
export async function confirmCapacityUnchanged(
  siteId: string,
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireActor("referent", "regulateur");
  if (!can.updateCapacity(actor, siteId))
    return { ok: false, error: "Accès refusé pour cet hôpital." };

  const current = await getCurrentCapacity(siteId);
  if (!current)
    return { ok: false, error: "Aucune capacité à confirmer : saisissez-la d'abord." };

  await db.insert(capacitySnapshots).values({
    siteId,
    icuBedsFree: current.icuBedsFree,
    wardBedsFree: current.wardBedsFree,
    orAvailable: current.orAvailable,
    burnSurgeonPresent: current.burnSurgeonPresent,
    suppliesOk: current.suppliesOk,
    note: current.note,
    declaredTotalIcu: current.declaredTotalIcu,
    declaredTotalWard: current.declaredTotalWard,
    createdBy: actor.userId,
  });

  await audit({
    userId: actor.userId,
    role: actor.role,
    action: "capacity.confirm_unchanged",
    entityType: "site",
    entityId: siteId,
    ip: await clientIp(),
  });

  revalidatePath("/hopital");
  return { ok: true };
}
