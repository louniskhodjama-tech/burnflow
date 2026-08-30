"use server";

import { redirect } from "next/navigation";
import { requireActor } from "@/lib/auth";
import { createAdvice } from "@/lib/advice";

export async function createAdviceAction(
  patientId: string,
  formData: FormData,
): Promise<{ ok: false; error: string } | never> {
  const actor = await requireActor("urgentiste");
  const question = String(formData.get("question") ?? "");
  const res = await createAdvice(actor, patientId, question);
  if (!res.ok) return res;
  redirect(`/patients/${patientId}?avis=envoye`);
}
