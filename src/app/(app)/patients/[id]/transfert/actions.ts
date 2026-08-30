"use server";

import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { cancelTransfer, createTransfer } from "@/lib/transfers";

export async function createTransferAction(patientId: string): Promise<
  { ok: false; error: string } | never
> {
  const actor = await requireActor("urgentiste");
  const res = await createTransfer(actor, patientId);
  if (!res.ok) return res;
  redirect(`/patients/${patientId}/transfert/${res.requestId}`);
}

export async function cancelTransferAction(
  patientId: string,
  requestId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireActor("urgentiste", "regulateur");
  const res = await cancelTransfer(actor, requestId, reason);
  return res;
}
