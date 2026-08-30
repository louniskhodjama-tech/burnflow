"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelTransferAction } from "../actions";

export function CancelTransferButton({
  patientId,
  requestId,
}: {
  patientId: string;
  requestId: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button className="btn-base flex-1 text-centre" onClick={() => setOpen(true)}>
        Annuler
      </button>
      {open && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-4">
            <h3 className="text-base font-semibold">Annuler la demande ?</h3>
            <p className="mt-1 text-[13px] text-muted">
              Si un lit était réservé, il sera libéré pour d&apos;autres patients.
            </p>
            <label className="field-label mt-2" htmlFor="cancelReason">
              Motif (recommandé)
            </label>
            <input
              id="cancelReason"
              className="input-base"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Ex. patient évacué autrement"
            />
            {error && <p className="mt-2 text-[14px] text-centre">{error}</p>}
            <div className="mt-3 flex gap-2">
              <button className="btn-base flex-1" onClick={() => setOpen(false)}>
                Retour
              </button>
              <button
                className="btn-primary flex-1 border-centre bg-centre"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    const res = await cancelTransferAction(patientId, requestId, reason);
                    if (res.ok) {
                      setOpen(false);
                      router.refresh();
                    } else setError(res.error ?? "Erreur.");
                  })
                }
              >
                {pending ? "Annulation…" : "Confirmer l'annulation"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
