"use server";

import { revalidatePath } from "next/cache";
import { requireActor } from "@/lib/auth";
import { answerAdvice, claimAdvice, releaseAdvice } from "@/lib/advice";

export async function claimAdviceAction(
  adviceId: string,
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireActor("brulologue");
  const res = await claimAdvice(actor, adviceId);
  revalidatePath("/avis");
  return res;
}

export async function releaseAdviceAction(
  adviceId: string,
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireActor("brulologue");
  const res = await releaseAdvice(actor, adviceId);
  revalidatePath("/avis");
  return res;
}

export async function answerAdviceAction(
  adviceId: string,
  answer: string,
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireActor("brulologue");
  const res = await answerAdvice(actor, adviceId, answer);
  revalidatePath("/avis");
  return res;
}
