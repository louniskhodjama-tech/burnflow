"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { respondTransferAction } from "../actions";

const DECLINE_REASONS = [
  "Plus de lit disponible",
  "Pas de chirurgien disponible",
  "Bloc opératoire indisponible",
  "Consommables insuffisants",
  "Patient trop grave pour notre plateau",
  "Autre (préciser)",
];

export function RespondForm({
  requestId,
  bedType,
}: {
  requestId: string;
  bedType: string;
}) {
  const router = useRouter();
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [freeText, setFreeText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function accept() {
    setError(null);
    startTransition(async () => {
      const res = await respondTransferAction(requestId, { accept: true });
      if (res.ok) router.push("/hopital/attendus");
      else setError(res.error ?? "Erreur.");
    });
  }

  function decline() {
    const finalReason =
      reason === "Autre (préciser)" ? freeText.trim() : reason;
    if (!finalReason) {
      setError("Choisissez ou précisez le motif de refus.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await respondTransferAction(requestId, {
        accept: false,
        reason: finalReason,
      });
      if (res.ok) router.push("/hopital/demandes");
      else setError(res.error ?? "Erreur.");
    });
  }

  const bedLabel =
    bedType === "ward" ? "lit d'hospitalisation" : bedType === "icu" ? "lit de réanimation" : "place de centre des brûlés";

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="card border-centre">
          <p className="text-centre text-[15px]">{error}</p>
        </div>
      )}

      {!declining ? (
        <>
          <button className="btn-primary min-h-14 bg-chir border-chir text-base" onClick={accept} disabled={pending}>
            {pending ? "…" : `Accepter — réserve 1 ${bedLabel}`}
          </button>
          <button className="btn-base min-h-14 text-base" onClick={() => setDeclining(true)} disabled={pending}>
            Refuser (motif obligatoire)
          </button>
        </>
      ) : (
        <section className="card">
          <h2 className="card-title">Motif du refus</h2>
          <div className="flex flex-col">
            {DECLINE_REASONS.map((r) => (
              <label key={r} className="flex min-h-11 items-center gap-2.5 border-b border-line text-[15px] last:border-b-0">
                <input
                  type="radio"
                  name="declineReason"
                  className="h-5 w-5 min-h-0"
                  checked={reason === r}
                  onChange={() => setReason(r)}
                />
                {r}
              </label>
            ))}
          </div>
          {reason === "Autre (préciser)" && (
            <input
              className="input-base mt-2"
              value={freeText}
              onChange={(e) => setFreeText(e.target.value)}
              placeholder="Précisez le motif"
            />
          )}
          <div className="mt-3 flex gap-2">
            <button className="btn-base flex-1" onClick={() => setDeclining(false)} disabled={pending}>
              Retour
            </button>
            <button
              className="btn-primary flex-1 border-centre bg-centre"
              onClick={decline}
              disabled={pending}
            >
              {pending ? "…" : "Confirmer le refus"}
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
