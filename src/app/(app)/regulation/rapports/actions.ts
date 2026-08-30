"use server";

import { requireActor } from "@/lib/auth";
import { sendSituationReport } from "@/lib/jobs";

export async function sendReportNowAction(): Promise<{ ok: boolean; error?: string }> {
  await requireActor("regulateur");
  try {
    await sendSituationReport();
    return { ok: true };
  } catch (e) {
    console.error("[rapport] envoi manuel :", e);
    return { ok: false, error: "Échec de l'envoi (voir logs serveur)." };
  }
}
