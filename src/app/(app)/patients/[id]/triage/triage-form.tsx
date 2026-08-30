"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BodyMap, emptyRegions } from "@/components/body-map";
import {
  computeScoring,
  type ClinicalRules,
  type Mechanism,
  type RegionsInput,
} from "@/lib/burn-scoring";
import { saveAssessment } from "../../actions";

type Factors = {
  age: number | null;
  weightKg: number | null;
  hoursSinceBurn: number | null;
  mechanism: Mechanism;
  inhalation: boolean;
  closedSpace: boolean;
  trauma: boolean;
  comorbidity: boolean;
};

export function TriageForm({
  patientId,
  braceletId,
  initialFactors,
  initialRegions,
  clinicalRules,
}: {
  patientId: string;
  braceletId: string;
  initialFactors: Factors;
  initialRegions: RegionsInput | null;
  clinicalRules: ClinicalRules;
}) {
  const router = useRouter();
  const [factors, setFactors] = useState<Factors>(initialFactors);
  const [regions, setRegions] = useState<RegionsInput>(() => ({
    ...emptyRegions(),
    ...(initialRegions ?? {}),
  }));
  const [warnings, setWarnings] = useState<string[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const scoring = useMemo(
    () => computeScoring(regions, factors, clinicalRules),
    [regions, factors, clinicalRules],
  );

  const setF = <K extends keyof Factors>(k: K, v: Factors[K]) =>
    setFactors((f) => ({ ...f, [k]: v }));

  const numInput = (v: string): number | null => {
    const s = v.trim().replace(",", ".");
    if (!s) return null;
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  };

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await saveAssessment(
        patientId,
        JSON.stringify({ ...factors, regions }),
      );
      if (!res.ok) {
        setError(res.error ?? "Erreur inconnue.");
        return;
      }
      if (res.warnings && res.warnings.length > 0) {
        setWarnings(res.warnings);
      } else {
        router.push(`/patients/${patientId}`);
      }
    });
  }

  const classChip =
    scoring.orientationClass === 1
      ? "bg-chir"
      : scoring.orientationClass === 2
        ? "bg-rea"
        : "bg-centre";

  return (
    <div className="pb-64">
      <h1 className="py-2 text-lg font-semibold">
        Triage — <span className="font-mono">{braceletId}</span>
      </h1>

      <section className="card mb-2">
        <h2 className="card-title">Patient</h2>
        <div className="flex flex-wrap gap-2">
          <Field label="Âge (ans)">
            <input
              className="input-base"
              type="number"
              inputMode="decimal"
              min={0}
              max={120}
              step="0.5"
              value={factors.age ?? ""}
              onChange={(e) => setF("age", numInput(e.target.value))}
              placeholder="34"
            />
          </Field>
          <Field label="Poids est. (kg)">
            <input
              className="input-base"
              type="number"
              inputMode="decimal"
              min={1}
              max={250}
              value={factors.weightKg ?? ""}
              onChange={(e) => setF("weightKg", numInput(e.target.value))}
              placeholder="70"
            />
          </Field>
          <Field label="Délai (h)">
            <input
              className="input-base"
              type="number"
              inputMode="decimal"
              min={0}
              max={96}
              step="0.5"
              value={factors.hoursSinceBurn ?? ""}
              onChange={(e) => setF("hoursSinceBurn", numInput(e.target.value))}
              placeholder="2"
            />
          </Field>
          <Field label="Mécanisme" grow>
            <select
              className="input-base"
              value={factors.mechanism}
              onChange={(e) => setF("mechanism", e.target.value as Mechanism)}
            >
              <option value="flamme">Flamme</option>
              <option value="contact">Contact / chaleur</option>
              <option value="elec">Électrique</option>
              <option value="chim">Chimique</option>
            </select>
          </Field>
        </div>
      </section>

      <section className="card mb-2">
        <h2 className="card-title">Touchez une zone</h2>
        <BodyMap regions={regions} onChange={setRegions} age={factors.age} />
      </section>

      <section className="card mb-2">
        <h2 className="card-title">Autres éléments</h2>
        <div className="flex flex-col">
          <FlagRow label="Inhalation suspectée" checked={factors.inhalation} onChange={(v) => setF("inhalation", v)} />
          <FlagRow label="Incendie en espace clos" checked={factors.closedSpace} onChange={(v) => setF("closedSpace", v)} />
          <FlagRow label="Lésion traumatique associée" checked={factors.trauma} onChange={(v) => setF("trauma", v)} />
          <FlagRow label="Comorbidité significative" checked={factors.comorbidity} onChange={(v) => setF("comorbidity", v)} last />
        </div>
      </section>

      {error && (
        <div className="card mb-2 border-centre">
          <p className="text-centre text-[15px]">{error}</p>
        </div>
      )}

      <button className="btn-primary w-full" onClick={submit} disabled={pending}>
        {pending ? "Enregistrement…" : "Valider le triage"}
      </button>

      {/* Bandeau de lecture — repris du prototype, au-dessus de la nav */}
      <div className="fixed inset-x-0 bottom-12 z-10 bg-ink px-4 py-3 text-white shadow-[0_-6px_24px_rgba(0,0,0,.18)]">
        <div className="mx-auto max-w-2xl">
          <div className="flex items-end justify-between">
            <div>
              <div className="text-[38px] font-bold leading-none tracking-tight tabular-nums">
                {scoring.scbTotal}
                <small className="ml-1 text-sm font-medium text-[#B8C4CE]">% SCB</small>
              </div>
              <div className="mt-1 text-[13px] text-[#B8C4CE]">
                dont <b className="text-white">{scoring.scbDeep}</b> % profond ·{" "}
                {scoring.ageBandLabel}
              </div>
            </div>
            <span className={`inline-block rounded-lg px-3 py-2 text-[15px] font-bold ${classChip}`}>
              {scoring.orientationLabel}
            </span>
          </div>
          <div className="mt-2 text-[13px] text-[#DDE5EA]">
            {scoring.parkland?.text ?? "Parkland : renseignez poids."}
          </div>
          {scoring.why.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1">
              {scoring.why.map((w) => (
                <span key={w} className="rounded-md bg-white/10 px-1.5 py-0.5 text-xs text-[#B8C4CE]">
                  {w}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {warnings && (
        <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/50 p-3 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-4">
            <h3 className="text-base font-semibold">Contrôle de cohérence</h3>
            <p className="mt-1 text-xs text-muted">
              Signalements suggestifs — le triage enregistré reste le vôtre.
            </p>
            <ul className="mt-2 list-disc pl-5 text-[14px]">
              {warnings.map((w) => (
                <li key={w} className="mb-1">
                  {w}
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <button className="btn-base flex-1" onClick={() => setWarnings(null)}>
                Corriger
              </button>
              <button
                className="btn-primary flex-1"
                onClick={() => router.push(`/patients/${patientId}`)}
              >
                Confirmer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  children,
  grow,
}: {
  label: string;
  children: React.ReactNode;
  grow?: boolean;
}) {
  return (
    <div className={grow ? "min-w-[160px] flex-[2]" : "min-w-[100px] flex-1"}>
      <label className="field-label">{label}</label>
      {children}
    </div>
  );
}

function FlagRow({
  label,
  checked,
  onChange,
  last,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}) {
  return (
    <label
      className={`flex min-h-11 items-center gap-2.5 text-[15px] ${
        last ? "" : "border-b border-line"
      }`}
    >
      <input
        type="checkbox"
        className="h-5.5 w-5.5 min-h-0"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      {label}
    </label>
  );
}
