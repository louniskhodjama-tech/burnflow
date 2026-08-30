"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cancelTransferRegAction, forceTransferAction } from "../../actions";

export function ForcePanel({
  requestId,
  status,
  targets,
}: {
  requestId: string;
  status: string;
  targets: { id: string; label: string }[];
}) {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!["pending", "accepted", "forced"].includes(status)) return null;

  return (
    <section className="card border-ink">
      <h2 className="card-title">Forcer / réassigner la destination</h2>
      <label className="field-label" htmlFor="forceTarget">
        Hôpital de destination
      </label>
      <select
        id="forceTarget"
        className="input-base"
        value={target}
        onChange={(e) => setTarget(e.target.value)}
      >
        <option value="">— choisir —</option>
        {targets.map((t) => (
          <option key={t.id} value={t.id}>
            {t.label}
          </option>
        ))}
      </select>
      <label className="field-label mt-2" htmlFor="forceReason">
        Motif (obligatoire, tracé dans le journal)
      </label>
      <input
        id="forceReason"
        className="input-base"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Ex. décision de régulation zonale"
      />
      {error && <p className="mt-2 text-[14px] text-centre">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          className="btn-primary flex-1"
          disabled={pending || !target || !reason.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await forceTransferAction(requestId, target, reason);
              if (res.ok) router.refresh();
              else setError(res.error ?? "Erreur.");
            })
          }
        >
          {pending ? "…" : "Forcer la destination"}
        </button>
        <button
          className="btn-base text-centre"
          disabled={pending || !reason.trim()}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await cancelTransferRegAction(requestId, reason);
              if (res.ok) router.refresh();
              else setError(res.error ?? "Erreur.");
            })
          }
        >
          Annuler la demande
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        Le forçage libère l&apos;éventuel lit déjà réservé et tente d&apos;en réserver un
        dans la cible (tracé si aucun lit libre).
      </p>
    </section>
  );
}
