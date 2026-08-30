"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { markArrivedAction } from "../demandes/actions";

export function ArrivedButton({ requestId }: { requestId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="flex flex-col items-end gap-1">
      {error && <span className="text-xs text-centre">{error}</span>}
      <button
        className="btn-primary border-chir bg-chir"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const res = await markArrivedAction(requestId);
            if (res.ok) router.refresh();
            else setError(res.error ?? "Erreur.");
          })
        }
      >
        {pending ? "…" : "Marquer arrivé"}
      </button>
    </div>
  );
}
