"use client";

import { useState, useTransition } from "react";
import { createTransferAction } from "./actions";

export function LaunchTransferButton({ patientId }: { patientId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <>
      {error && (
        <div className="card border-centre">
          <p className="text-centre text-[15px]">{error}</p>
        </div>
      )}
      <button
        className="btn-primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const res = await createTransferAction(patientId);
            if (res && !res.ok) setError(res.error);
          })
        }
      >
        {pending ? "Recherche en cours…" : "Lancer la recherche d'hôpital"}
      </button>
    </>
  );
}
