"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  answerAdviceAction,
  claimAdviceAction,
  releaseAdviceAction,
} from "../actions";

export function AdviceActions({
  adviceId,
  state,
}: {
  adviceId: string;
  state: "open" | "mine" | "taken";
}) {
  const router = useRouter();
  const [answer, setAnswer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const res = await fn();
      if (res.ok) router.refresh();
      else setError(res.error ?? "Erreur.");
    });

  if (state === "taken") {
    return (
      <div className="card">
        <p className="text-[14px] text-muted">
          Cette demande est en cours de traitement par un autre brûlologue.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <div className="card border-centre">
          <p className="text-centre text-[15px]">{error}</p>
        </div>
      )}

      {state === "open" ? (
        <button
          className="btn-primary min-h-14 text-base"
          disabled={pending}
          onClick={() => run(() => claimAdviceAction(adviceId))}
        >
          {pending ? "…" : "Prendre cette demande"}
        </button>
      ) : (
        <>
          <section className="card">
            <label className="field-label" htmlFor="answer">
              Votre réponse (texte libre, visible immédiatement par l&apos;urgentiste)
            </label>
            <textarea
              id="answer"
              className="input-base min-h-36"
              value={answer}
              maxLength={5000}
              onChange={(e) => setAnswer(e.target.value)}
              placeholder="Votre avis structuré : analyse, conduite à tenir, surveillance…"
            />
          </section>
          <button
            className="btn-primary min-h-14 border-chir bg-chir text-base"
            disabled={pending}
            onClick={() => run(() => answerAdviceAction(adviceId, answer))}
          >
            {pending ? "Envoi…" : "Envoyer la réponse"}
          </button>
          <button
            className="btn-base"
            disabled={pending}
            onClick={() => run(() => releaseAdviceAction(adviceId))}
          >
            Relâcher sans répondre (retourne en file)
          </button>
        </>
      )}
    </div>
  );
}
