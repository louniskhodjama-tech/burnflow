"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  createUserAction,
  extendCodeAction,
  generateCodeAction,
  revokeCodeAction,
  setUserActiveAction,
} from "../actions";

const DUREES: { h: number; label: string }[] = [
  { h: 24, label: "24 h" },
  { h: 72, label: "3 jours" },
  { h: 168, label: "7 jours" },
  { h: 720, label: "30 jours" },
];

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("fr-DZ", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const ROLE_LABELS: Record<string, string> = {
  urgentiste: "Urgentiste",
  referent: "Référent hôpital",
  regulateur: "Régulateur",
  brulologue: "Brûlologue",
};

export function UserRow({
  user,
}: {
  user: {
    id: string;
    displayName: string;
    email: string | null;
    role: string;
    isAdmin: boolean;
    active: boolean;
    siteNames: string[];
    lastLoginAt: string | null;
    codes: {
      id: string;
      createdAt: string;
      expiresAt: string;
      lastUsedAt: string | null;
      useCount: number;
    }[];
  };
}) {
  const router = useRouter();
  const [code, setCode] = useState<{ value: string; expiresAt: string } | null>(null);
  const [duree, setDuree] = useState(168);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <li className={`rounded-lg border p-2 ${user.active ? "border-line" : "border-line opacity-60"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-medium">
            {user.displayName}
            {user.isAdmin ? " · admin" : ""}
          </div>
          <div className="truncate text-xs text-muted">
            {ROLE_LABELS[user.role]}
            {user.email ? ` · ${user.email}` : ""}
            {user.siteNames.length ? ` · ${user.siteNames.join(", ")}` : ""}
          </div>
          <div className="text-xs text-muted">
            {user.lastLoginAt
              ? `Dernière connexion : ${new Date(user.lastLoginAt).toLocaleString("fr-DZ", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}`
              : "Jamais connecté"}
          </div>
        </div>
        <div className="flex shrink-0 gap-1">
          <select
            className="min-h-9 rounded-md border border-line bg-white px-1 text-[13px]"
            value={duree}
            disabled={pending || !user.active}
            onChange={(e) => setDuree(Number(e.target.value))}
            aria-label="Durée de validité du code"
          >
            {DUREES.map((d) => (
              <option key={d.h} value={d.h}>
                {d.label}
              </option>
            ))}
          </select>
          <button
            className="btn-base min-h-9 px-2 text-[13px]"
            disabled={pending || !user.active}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const res = await generateCodeAction(user.id, duree);
                if (res.ok && res.code && res.expiresAt)
                  setCode({ value: res.code, expiresAt: res.expiresAt });
                else setError(res.error ?? "Erreur.");
              })
            }
          >
            Code
          </button>
          <button
            className={`btn-base min-h-9 px-2 text-[13px] ${user.active ? "text-centre" : "text-chir"}`}
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                setError(null);
                const res = await setUserActiveAction(user.id, !user.active);
                if (res.ok) router.refresh();
                else setError(res.error ?? "Erreur.");
              })
            }
          >
            {user.active ? "Désactiver" : "Réactiver"}
          </button>
        </div>
      </div>
      {code && (
        <div className="mt-2 rounded-lg border border-chir bg-chir/5 p-2">
          <p className="text-[13px]">
            Code <b>personnel</b> de <b>{user.displayName}</b> — valable
            jusqu&apos;au <b>{fmtDate(code.expiresAt)}</b>, réutilisable sur ses
            appareils, révocable à tout moment. À transmettre oralement à cette
            personne uniquement : toute action faite avec ce code est tracée à
            son nom. Il ne sera plus affiché :
          </p>
          <p className="mt-1 text-center font-mono text-2xl font-bold tracking-[0.2em]">
            {code.value}
          </p>
        </div>
      )}
      {user.codes.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {user.codes.map((ac) => (
            <li
              key={ac.id}
              className="flex flex-wrap items-center justify-between gap-1 rounded-md bg-bg px-2 py-1 text-xs"
            >
              <span>
                Code du {fmtDate(ac.createdAt)} · expire {fmtDate(ac.expiresAt)} ·{" "}
                {ac.useCount > 0
                  ? `${ac.useCount} connexion${ac.useCount > 1 ? "s" : ""}${ac.lastUsedAt ? `, dernière ${fmtDate(ac.lastUsedAt)}` : ""}`
                  : "jamais utilisé"}
              </span>
              <span className="flex gap-1">
                <button
                  className="min-h-0 rounded border border-line bg-white px-1.5 py-0.5"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      setError(null);
                      const res = await extendCodeAction(ac.id, 168);
                      if (res.ok) router.refresh();
                      else setError(res.error ?? "Erreur.");
                    })
                  }
                >
                  Prolonger +7 j
                </button>
                <button
                  className="min-h-0 rounded border border-line bg-white px-1.5 py-0.5 text-centre"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      setError(null);
                      const res = await revokeCodeAction(ac.id);
                      if (res.ok) router.refresh();
                      else setError(res.error ?? "Erreur.");
                    })
                  }
                >
                  Révoquer
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-1 text-xs text-centre">{error}</p>}
    </li>
  );
}

export function NewUserForm({
  siteOptions,
}: {
  siteOptions: { id: string; label: string; kind: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    displayName: "",
    email: "",
    role: "urgentiste",
    siteIds: [] as string[],
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + Créer un utilisateur
      </button>
    );
  }

  const needsSites = v.role === "urgentiste" || v.role === "referent";
  const eligibleSites =
    v.role === "urgentiste"
      ? siteOptions.filter((s) => s.kind === "triage_point")
      : v.role === "referent"
        ? siteOptions.filter((s) => s.kind !== "triage_point")
        : [];

  return (
    <section className="card">
      <h2 className="card-title">Nouvel utilisateur</h2>
      <div className="flex flex-col gap-2">
        <input
          className="input-base"
          placeholder="Nom affiché (ex. Dr K. — EPH Jijel)"
          value={v.displayName}
          onChange={(e) => setV({ ...v, displayName: e.target.value })}
        />
        <input
          className="input-base"
          type="email"
          placeholder="Email (vide = connexion par code uniquement)"
          value={v.email}
          onChange={(e) => setV({ ...v, email: e.target.value })}
        />
        <select
          className="input-base"
          value={v.role}
          onChange={(e) => setV({ ...v, role: e.target.value, siteIds: [] })}
        >
          <option value="urgentiste">Urgentiste</option>
          <option value="referent">Référent hôpital</option>
          <option value="regulateur">Régulateur</option>
          <option value="brulologue">Brûlologue consultant</option>
        </select>
        {needsSites && eligibleSites.length === 0 && (
          <p className="rounded-lg border border-line bg-bg px-2 py-2 text-[13px] text-muted">
            {v.role === "urgentiste"
              ? "Aucun point médical n'existe encore : créez-le d'abord dans Régulation → Sites (type « Point médical »), puis revenez rattacher l'urgentiste."
              : "Aucun hôpital n'existe encore : créez-le d'abord dans Régulation → Sites."}
          </p>
        )}
        {needsSites && eligibleSites.length > 0 && (
          <div className="max-h-48 overflow-y-auto rounded-lg border border-line p-1">
            {eligibleSites.map((s) => (
              <label key={s.id} className="flex min-h-10 items-center gap-2 border-b border-line px-1 text-[14px] last:border-b-0">
                <input
                  type={v.role === "referent" ? "radio" : "checkbox"}
                  name="siteSel"
                  className="h-4.5 w-4.5 min-h-0"
                  checked={v.siteIds.includes(s.id)}
                  onChange={(e) => {
                    if (v.role === "referent") setV({ ...v, siteIds: [s.id] });
                    else
                      setV({
                        ...v,
                        siteIds: e.target.checked
                          ? [...v.siteIds, s.id]
                          : v.siteIds.filter((x) => x !== s.id),
                      });
                  }}
                />
                {s.label}
              </label>
            ))}
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-[14px] text-centre">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button className="btn-base flex-1" onClick={() => setOpen(false)}>
          Annuler
        </button>
        <button
          className="btn-primary flex-1"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setError(null);
              const res = await createUserAction({
                displayName: v.displayName,
                email: v.email.trim() || null,
                role: v.role as "urgentiste" | "referent" | "regulateur" | "brulologue",
                siteIds: v.siteIds,
              });
              if (res.ok) {
                setOpen(false);
                setV({ displayName: "", email: "", role: "urgentiste", siteIds: [] });
                router.refresh();
              } else setError(res.error ?? "Erreur.");
            })
          }
        >
          {pending ? "…" : "Créer"}
        </button>
      </div>
    </section>
  );
}
