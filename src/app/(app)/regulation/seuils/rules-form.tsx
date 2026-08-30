"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProtocolSection, RulesJson } from "@/db/schema";
import { updateRulesAction } from "../actions";

export function RulesForm({ initial }: { initial: RulesJson }) {
  const router = useRouter();
  const [v, setV] = useState<RulesJson>(initial);
  const [comment, setComment] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const setProtocol = (idx: number, patch: Partial<ProtocolSection>) =>
    setV((prev) => ({
      ...prev,
      protocols: (prev.protocols ?? []).map((s, i) =>
        i === idx ? { ...s, ...patch } : s,
      ),
    }));

  const num =
    (path: (n: number) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const n = Number(e.target.value.replace(",", "."));
      if (Number.isFinite(n)) path(n);
    };

  return (
    <div className="flex flex-col gap-2">
      <section className="card">
        <h2 className="card-title">Seuils cliniques (prototype validé)</h2>
        <Field label={`SCB → réanimation (≥ %, actuel ${v.reaSCB})`}>
          <input className="input-base" type="number" inputMode="decimal" defaultValue={v.reaSCB} onChange={num((n) => setV({ ...v, reaSCB: n }))} />
        </Field>
        <Field label={`Enfant : âge < (ans)`}>
          <input className="input-base" type="number" inputMode="decimal" defaultValue={v.childBelow} onChange={num((n) => setV({ ...v, childBelow: n }))} />
        </Field>
        <Field label={`Âgé : âge > (ans)`}>
          <input className="input-base" type="number" inputMode="decimal" defaultValue={v.elderlyAbove} onChange={num((n) => setV({ ...v, elderlyAbove: n }))} />
        </Field>
        <Field label={`3e degré = signe si ≥ (%)`}>
          <input className="input-base" type="number" inputMode="decimal" defaultValue={v.thirdDegreeSign} onChange={num((n) => setV({ ...v, thirdDegreeSign: n }))} />
        </Field>
        <Field label={`Parkland (ml/kg/% SCB)`}>
          <input className="input-base" type="number" inputMode="decimal" defaultValue={v.parklandMlKgPct} onChange={num((n) => setV({ ...v, parklandMlKgPct: n }))} />
        </Field>
      </section>

      <section className="card">
        <h2 className="card-title">Routage</h2>
        <Field label={`λ — pondération de la charge (actuel ${v.routing.lambda})`}>
          <input className="input-base" type="number" inputMode="decimal" step="0.1" defaultValue={v.routing.lambda} onChange={num((n) => setV({ ...v, routing: { ...v.routing, lambda: n } }))} />
        </Field>
        <Field label={`Saturation (occupation ≥, 0–1)`}>
          <input className="input-base" type="number" inputMode="decimal" step="0.05" defaultValue={v.routing.saturationThreshold} onChange={num((n) => setV({ ...v, routing: { ...v.routing, saturationThreshold: n } }))} />
        </Field>
        <Field label={`Taille max de cascade`}>
          <input className="input-base" type="number" inputMode="numeric" defaultValue={v.routing.cascadeMax} onChange={num((n) => setV({ ...v, routing: { ...v.routing, cascadeMax: Math.round(n) } }))} />
        </Field>
        <Field label={`Délai de réponse hôpital (min)`}>
          <input className="input-base" type="number" inputMode="numeric" defaultValue={v.routing.timeoutMinutes} onChange={num((n) => setV({ ...v, routing: { ...v.routing, timeoutMinutes: Math.round(n) } }))} />
        </Field>
        <Field label={`Capacité périmée après (h)`}>
          <input className="input-base" type="number" inputMode="decimal" defaultValue={v.routing.capacityStaleHours} onChange={num((n) => setV({ ...v, routing: { ...v.routing, capacityStaleHours: n } }))} />
        </Field>
        <Field label={`Avis non répondu → retour en file après (min)`}>
          <input className="input-base" type="number" inputMode="numeric" defaultValue={v.routing.adviceReleaseMinutes} onChange={num((n) => setV({ ...v, routing: { ...v.routing, adviceReleaseMinutes: Math.round(n) } }))} />
        </Field>
        <label className="mt-1 flex min-h-11 items-center justify-between text-[15px]">
          <span>Mode centre protégé (classe 3 prioritaire aux centres)</span>
          <input
            type="checkbox"
            className="h-6 w-6 min-h-0"
            checked={v.routing.protectedCenters}
            onChange={(e) => setV({ ...v, routing: { ...v.routing, protectedCenters: e.target.checked } })}
          />
        </label>
      </section>

      <section className="card">
        <h2 className="card-title">Conduite à tenir (protocoles)</h2>
        <p className="mb-2 text-xs text-muted">
          Affichés à l&apos;urgentiste selon la classe du patient, repris dans la
          fiche de transfert. Les « gestes cochables » (un par ligne) alimentent
          la traçabilité. Contenu sous la responsabilité de l&apos;autorité
          médicale.
        </p>
        <div className="flex flex-col gap-3">
          {(v.protocols ?? []).map((s, idx) => (
            <div key={s.id} className="rounded-lg border border-line p-2">
              <div className="mb-1 flex items-center justify-between gap-2">
                <input
                  className="input-base min-h-10 flex-1 text-[14px] font-semibold"
                  value={s.title}
                  onChange={(e) => setProtocol(idx, { title: e.target.value })}
                  placeholder="Titre de la section"
                />
                <button
                  type="button"
                  className="min-h-0 shrink-0 rounded border border-line bg-white px-2 py-1 text-xs text-centre"
                  onClick={() =>
                    setV({
                      ...v,
                      protocols: (v.protocols ?? []).filter((_, i) => i !== idx),
                    })
                  }
                >
                  Supprimer
                </button>
              </div>
              <div className="mb-1 flex gap-3 text-[13px]">
                {[1, 2, 3].map((k) => (
                  <label key={k} className="flex min-h-0 items-center gap-1">
                    <input
                      type="checkbox"
                      className="h-4 w-4 min-h-0"
                      checked={s.classes.includes(k as 1 | 2 | 3)}
                      onChange={(e) =>
                        setProtocol(idx, {
                          classes: e.target.checked
                            ? ([...s.classes, k] as (1 | 2 | 3)[])
                            : s.classes.filter((x) => x !== k),
                        })
                      }
                    />
                    classe {k}
                  </label>
                ))}
              </div>
              <label className="field-label">Texte du protocole</label>
              <textarea
                className="input-base min-h-28 text-[13px]"
                value={s.content}
                maxLength={8000}
                onChange={(e) => setProtocol(idx, { content: e.target.value })}
              />
              <label className="field-label mt-1">
                Gestes cochables (un par ligne)
              </label>
              <textarea
                className="input-base min-h-20 text-[13px]"
                value={s.items.join("\n")}
                onChange={(e) =>
                  setProtocol(idx, {
                    items: e.target.value
                      .split("\n")
                      .map((l) => l.trim())
                      .filter(Boolean)
                      .slice(0, 20),
                  })
                }
              />
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn-base mt-2 w-full"
          onClick={() =>
            setV({
              ...v,
              protocols: [
                ...(v.protocols ?? []),
                {
                  id: `section-${(v.protocols?.length ?? 0) + 1}-${Math.random().toString(36).slice(2, 7)}`,
                  title: "",
                  classes: [1, 2, 3],
                  content: "",
                  items: [],
                } satisfies ProtocolSection,
              ],
            })
          }
        >
          + Ajouter une section
        </button>
      </section>

      <section className="card">
        <label className="field-label" htmlFor="rulesComment">
          Commentaire de version (recommandé)
        </label>
        <input
          id="rulesComment"
          className="input-base"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Ex. seuil réa abaissé à 15 % — décision Dr X"
        />
      </section>

      {msg && (
        <div className="card border-chir">
          <p className="text-[15px] text-chir">{msg}</p>
        </div>
      )}
      {error && (
        <div className="card border-centre">
          <p className="text-[15px] text-centre">{error}</p>
        </div>
      )}

      <button
        className="btn-primary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setMsg(null);
            setError(null);
            const res = await updateRulesAction(v, comment);
            if (res.ok) {
              setMsg(`Nouvelle version enregistrée : v${res.version}.`);
              setComment("");
              router.refresh();
            } else setError(res.error ?? "Erreur.");
          })
        }
      >
        {pending ? "Enregistrement…" : "Enregistrer (nouvelle version)"}
      </button>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-2">
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}
