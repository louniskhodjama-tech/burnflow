"use client";

import { useState, useTransition } from "react";
import { sendReportNowAction } from "./actions";

export function SendReportButton() {
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-2">
      <button
        className="btn-base w-full"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await sendReportNowAction();
            setMsg(res.ok ? "Rapport envoyé aux régulateurs (email)." : (res.error ?? "Erreur."));
          })
        }
      >
        {pending ? "Envoi…" : "Envoyer le rapport maintenant"}
      </button>
      {msg && <p className="mt-1 text-[13px] text-muted">{msg}</p>}
    </div>
  );
}
