"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth";
import { markArrived, respondTransfer } from "@/lib/transfers";

export async function respondTransferAction(
  requestId: string,
  decision: { accept: true } | { accept: false; reason: string },
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireActor("referent");
  const res = await respondTransfer(actor, requestId, decision);
  revalidatePath("/hopital/demandes");
  revalidatePath("/hopital/attendus");
  return res;
}

export async function markArrivedAction(
  requestId: string,
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireActor("referent", "regulateur");
  const res = await markArrived(actor, requestId);
  revalidatePath("/hopital/attendus");
  return res;
}
