"use client";

import { useState, useTransition } from "react";
import { createAdviceAction } from "./actions";

export function AdviceForm({ patientId }: { patientId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <form
      action={(fd) =>
        startTransition(async () => {
          setError(null);
          const res = await createAdviceAction(patientId, fd);
          if (res && !res.ok) setError(res.error);
        })
      }
      className="flex flex-col gap-2"
    >
      <section className="card">
        <label className="field-label" htmlFor="question">
          Votre question (libre)
        </label>
        <textarea
          id="question"
          name="question"
          className="input-base min-h-32"
          maxLength={2000}
          placeholder="Ex. Indication d'escarrotomie sur brûlure circonférentielle du membre supérieur droit ? Conduite du remplissage compte tenu du délai ?"
          required
        />
      </section>
      {error && (
        <div className="card border-centre">
          <p className="text-centre text-[15px]">{error}</p>
        </div>
      )}
      <button className="btn-primary" type="submit" disabled={pending}>
        {pending ? "Envoi…" : "Envoyer la demande d'avis"}
      </button>
    </form>
  );
}
