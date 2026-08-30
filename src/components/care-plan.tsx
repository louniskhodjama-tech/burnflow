"use client";

/**
 * Conduite à tenir : sections de protocole (filtrées par classe) avec
 * gestes cochables par l'urgentiste — chaque coche est tracée (heure + auteur).
 * Contenu éditable par le régulateur (Seuils), versionné.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ProtocolSection } from "@/db/schema";
import { careItemKey } from "@/lib/protocols";
import { toggleCareAction } from "@/app/(app)/patients/actions";

export type CareChecked = Record<string, { doneAt: string; byName: string }>;

export function CarePlan({
  patientId,
  sections,
  checked,
  readOnly,
}: {
  patientId: string;
  sections: ProtocolSection[];
  checked: CareChecked;
  readOnly: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (sections.length === 0) return null;

  const toggle = (section: ProtocolSection, index: number, label: string, done: boolean) =>
    startTransition(async () => {
      setError(null);
      const res = await toggleCareAction(patientId, {
        itemKey: careItemKey(section.id, index),
        label,
        sectionTitle: section.title,
        done,
      });
      if (res.ok) router.refresh();
      else setError(res.error ?? "Erreur.");
    });

  return (
    <section className="card">
      <h2 className="card-title">Conduite à tenir</h2>
      <p className="mb-2 text-xs text-muted">
        Protocoles définis par la régulation — à adapter au jugement clinique.
        Cochez les gestes réalisés : ils partent avec la fiche de transfert.
      </p>
      <div className="flex flex-col gap-1.5">
        {sections.map((s) => (
          <details key={s.id} className="rounded-lg border border-line">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between px-2 text-[15px] font-medium [&::-webkit-details-marker]:hidden">
              <span>{s.title}</span>
              <span className="text-xs text-muted">
                {s.items.filter((_, i) => checked[careItemKey(s.id, i)]).length}/
                {s.items.length} ▾
              </span>
            </summary>
            <div className="border-t border-line px-2 py-2">
              <p className="whitespace-pre-wrap text-[13px] leading-6 text-ink">
                {s.content}
              </p>
              {s.items.length > 0 && (
                <ul className="mt-2 flex flex-col">
                  {s.items.map((label, i) => {
                    const key = careItemKey(s.id, i);
                    const state = checked[key];
                    return (
                      <li key={key} className="border-t border-line first:border-t-0">
                        <label className="flex min-h-11 items-start gap-2.5 py-1.5 text-[14px]">
                          <input
                            type="checkbox"
                            className="mt-1 h-5 w-5 min-h-0 shrink-0"
                            checked={!!state}
                            disabled={readOnly || pending}
                            onChange={(e) => toggle(s, i, label, e.target.checked)}
                          />
                          <span>
                            {label}
                            {state && (
                              <span className="block text-xs text-chir">
                                ✓{" "}
                                {new Date(state.doneAt).toLocaleTimeString("fr-DZ", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}{" "}
                                · {state.byName}
                              </span>
                            )}
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </details>
        ))}
      </div>
      {error && <p className="mt-2 text-[14px] text-centre">{error}</p>}
      <p className="mt-2 text-[11px] text-muted">
        Contenu validé par l'autorité médicale du déploiement — aide à la
        décision, ne remplace pas le jugement clinique.
      </p>
    </section>
  );
}
