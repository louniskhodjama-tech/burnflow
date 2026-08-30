"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { confirmCapacityUnchanged, submitCapacity } from "./actions";

type Values = {
  icuBedsFree: number;
  wardBedsFree: number;
  orAvailable: boolean;
  burnSurgeonPresent: boolean;
  suppliesOk: boolean;
  note: string;
  declaredTotalIcu: number | null;
  declaredTotalWard: number | null;
};

const DEFAULTS: Values = {
  icuBedsFree: 0,
  wardBedsFree: 0,
  orAvailable: false,
  burnSurgeonPresent: false,
  suppliesOk: true,
  note: "",
  declaredTotalIcu: null,
  declaredTotalWard: null,
};

export function CapacityForm({
  siteId,
  initial,
  hasCurrent,
}: {
  siteId: string;
  initial: Values | null;
  hasCurrent: boolean;
}) {
  const router = useRouter();
  const [v, setV] = useState<Values>(initial ?? DEFAULTS);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const set = <K extends keyof Values>(k: K, val: Values[K]) =>
    setV((s) => ({ ...s, [k]: val }));

  function save() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await submitCapacity({
        siteId,
        icuBedsFree: v.icuBedsFree,
        wardBedsFree: v.wardBedsFree,
        orAvailable: v.orAvailable,
        burnSurgeonPresent: v.burnSurgeonPresent,
        suppliesOk: v.suppliesOk,
        note: v.note.trim() || null,
        declaredTotalIcu: v.declaredTotalIcu,
        declaredTotalWard: v.declaredTotalWard,
      });
      if (res.ok) {
        setMsg("Capacité enregistrée.");
        router.refresh();
      } else setErr(res.error ?? "Erreur.");
    });
  }

  function confirmUnchanged() {
    setMsg(null);
    setErr(null);
    startTransition(async () => {
      const res = await confirmCapacityUnchanged(siteId);
      if (res.ok) {
        setMsg("Capacité confirmée inchangée.");
        router.refresh();
      } else setErr(res.error ?? "Erreur.");
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <section className="card">
        <h2 className="card-title">Lits libres</h2>
        <Counter
          label="Réanimation (lits libres)"
          value={v.icuBedsFree}
          onChange={(n) => set("icuBedsFree", n)}
          total={v.declaredTotalIcu}
          onTotalChange={(n) => set("declaredTotalIcu", n)}
        />
        <Counter
          label="Hospitalisation / chirurgie (lits libres)"
          value={v.wardBedsFree}
          onChange={(n) => set("wardBedsFree", n)}
          total={v.declaredTotalWard}
          onTotalChange={(n) => set("declaredTotalWard", n)}
        />
      </section>

      <section className="card">
        <h2 className="card-title">Moyens</h2>
        <Toggle label="Bloc opératoire disponible" checked={v.orAvailable} onChange={(b) => set("orAvailable", b)} />
        <Toggle label="Chirurgien formé aux brûlés présent" checked={v.burnSurgeonPresent} onChange={(b) => set("burnSurgeonPresent", b)} />
        <Toggle label="Consommables suffisants (pansements, SSI…)" checked={v.suppliesOk} onChange={(b) => set("suppliesOk", b)} last />
      </section>

      <section className="card">
        <h2 className="card-title">Note (visible du régulateur)</h2>
        <textarea
          className="input-base min-h-20"
          value={v.note}
          maxLength={500}
          onChange={(e) => set("note", e.target.value)}
          placeholder="Ex. groupe électrogène en panne, plus de tulle gras…"
        />
      </section>

      {msg && (
        <div className="card border-chir">
          <p className="text-[15px] text-chir">{msg}</p>
        </div>
      )}
      {err && (
        <div className="card border-centre">
          <p className="text-[15px] text-centre">{err}</p>
        </div>
      )}

      <button className="btn-primary" onClick={save} disabled={pending}>
        {pending ? "Enregistrement…" : "Enregistrer la capacité"}
      </button>
      {hasCurrent && (
        <button className="btn-base" onClick={confirmUnchanged} disabled={pending}>
          Confirmer inchangé (horodatage remis à zéro)
        </button>
      )}
    </div>
  );
}

function Counter({
  label,
  value,
  onChange,
  total,
  onTotalChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  total: number | null;
  onTotalChange: (n: number | null) => void;
}) {
  return (
    <div className="border-b border-line py-2 last:border-b-0">
      <div className="mb-1 text-[14px]">{label}</div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="btn-base h-14 w-16 text-2xl font-bold"
          onClick={() => onChange(Math.max(0, value - 1))}
          aria-label={`Diminuer ${label}`}
        >
          −
        </button>
        <div className="min-w-16 flex-1 text-center text-4xl font-bold tabular-nums">
          {value}
        </div>
        <button
          type="button"
          className="btn-base h-14 w-16 text-2xl font-bold"
          onClick={() => onChange(Math.min(9999, value + 1))}
          aria-label={`Augmenter ${label}`}
        >
          +
        </button>
      </div>
      <div className="mt-1 flex items-center justify-end gap-2 text-xs text-muted">
        <label className="min-h-0">
          total du service (optionnel) :
          <input
            type="number"
            inputMode="numeric"
            className="ml-1 w-16 rounded-md border border-line px-1 py-0.5 text-center"
            min={0}
            max={9999}
            value={total ?? ""}
            onChange={(e) => {
              const s = e.target.value.trim();
              onTotalChange(s === "" ? null : Math.max(0, Number(s) || 0));
            }}
          />
        </label>
      </div>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
  last,
}: {
  label: string;
  checked: boolean;
  onChange: (b: boolean) => void;
  last?: boolean;
}) {
  return (
    <label
      className={`flex min-h-12 items-center justify-between gap-2 text-[15px] ${
        last ? "" : "border-b border-line"
      }`}
    >
      <span>{label}</span>
      <input
        type="checkbox"
        className="h-6 w-6 min-h-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
    </label>
  );
}
