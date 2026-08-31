"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CoordPicker } from "@/components/coord-picker";
import { createSiteAction, updateSiteAction } from "../actions";

const KIND_LABELS: Record<string, string> = {
  triage_point: "Point médical",
  hospital: "Hôpital",
  burn_center: "Centre des brûlés",
};

type Site = {
  id: string;
  kind: "triage_point" | "hospital" | "burn_center";
  name: string;
  wilaya: string;
  lat: number;
  lng: number;
  phone: string | null;
  active: boolean;
  toVerify: boolean;
};

export function SiteRow({ site }: { site: Site }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (payload: Parameters<typeof updateSiteAction>[1]) =>
    startTransition(async () => {
      setError(null);
      const res = await updateSiteAction(site.id, payload);
      if (res.ok) router.refresh();
      else setError(res.error ?? "Erreur.");
    });

  return (
    <li className="rounded-lg border border-line p-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[15px] font-medium">
            {site.kind === "burn_center" ? "★ " : ""}
            {site.name}
          </div>
          <div className="text-xs text-muted">
            {KIND_LABELS[site.kind]} · {site.wilaya} · {site.lat.toFixed(3)},{" "}
            {site.lng.toFixed(3)}
            {site.phone ? ` · ${site.phone}` : ""}
          </div>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {site.toVerify ? (
            <button
              className="btn-primary min-h-9 px-2 text-[13px]"
              disabled={pending}
              onClick={() => run({ toVerify: false })}
            >
              Marquer vérifié
            </button>
          ) : site.active ? (
            <button
              className="btn-base min-h-9 px-2 text-[13px] text-centre"
              disabled={pending}
              onClick={() => run({ active: false })}
            >
              Désactiver
            </button>
          ) : (
            <button
              className="btn-primary min-h-9 border-chir bg-chir px-2 text-[13px]"
              disabled={pending}
              onClick={() => run({ active: true })}
            >
              Activer
            </button>
          )}
          <span className={`text-xs ${site.active ? "text-chir" : "text-muted"}`}>
            {site.active ? "actif" : "inactif"}
          </span>
        </div>
      </div>
      {site.toVerify && <PositionVerifier site={site} />}
      {error && <p className="mt-1 text-xs text-centre">{error}</p>}
    </li>
  );
}

/**
 * Vérification visuelle de la position avant « Marquer vérifié » : l'épingle
 * sur la carte dit immédiatement si les coordonnées importées sont bonnes.
 * La carte n'est montée qu'à l'ouverture (26 sites = pas 26 cartes).
 */
function PositionVerifier({ site }: { site: Site }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [lat, setLat] = useState(String(site.lat));
  const [lng, setLng] = useState(String(site.lng));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const dirty = lat !== String(site.lat) || lng !== String(site.lng);

  return (
    <details
      className="mt-1"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
    >
      <summary className="cursor-pointer list-none text-[13px] text-muted underline">
        Vérifier la position sur la carte
      </summary>
      {open && (
        <div className="mt-2 flex flex-col gap-2">
          <CoordPicker
            lat={lat}
            lng={lng}
            onChange={(a, b) => {
              setLat(a);
              setLng(b);
            }}
          />
          {dirty && (
            <button
              className="btn-primary"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const res = await updateSiteAction(site.id, {
                    lat: Number(lat.replace(",", ".")),
                    lng: Number(lng.replace(",", ".")),
                  });
                  if (res.ok) router.refresh();
                  else setError(res.error ?? "Erreur.");
                })
              }
            >
              {pending ? "…" : "Enregistrer la position corrigée"}
            </button>
          )}
          {error && <p className="text-xs text-centre">{error}</p>}
        </div>
      )}
    </details>
  );
}

export function NewSiteForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [v, setV] = useState({
    kind: "hospital" as Site["kind"],
    name: "",
    wilaya: "",
    lat: "",
    lng: "",
    phone: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + Ajouter un site (en urgence)
      </button>
    );
  }

  return (
    <section className="card">
      <h2 className="card-title">Nouveau site</h2>
      <div className="flex flex-col gap-2">
        <select
          className="input-base"
          value={v.kind}
          onChange={(e) => setV({ ...v, kind: e.target.value as Site["kind"] })}
        >
          <option value="triage_point">Point médical</option>
          <option value="hospital">Hôpital</option>
          <option value="burn_center">Centre des brûlés</option>
        </select>
        <input className="input-base" placeholder="Nom complet" value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} />
        <input className="input-base" placeholder="Wilaya" value={v.wilaya} onChange={(e) => setV({ ...v, wilaya: e.target.value })} />
        <CoordPicker
          lat={v.lat}
          lng={v.lng}
          onChange={(lat, lng) => setV({ ...v, lat, lng })}
        />
        <input className="input-base" placeholder="Téléphone du service (optionnel)" value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} />
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
              const lat = Number(v.lat.replace(",", "."));
              const lng = Number(v.lng.replace(",", "."));
              const res = await createSiteAction({
                kind: v.kind,
                name: v.name,
                wilaya: v.wilaya,
                lat,
                lng,
                phone: v.phone.trim() || null,
              });
              if (res.ok) {
                setOpen(false);
                setV({ kind: "hospital", name: "", wilaya: "", lat: "", lng: "", phone: "" });
                router.refresh();
              } else setError(res.error ?? "Erreur.");
            })
          }
        >
          {pending ? "…" : "Créer (à vérifier)"}
        </button>
      </div>
      <p className="mt-1 text-xs text-muted">
        Le site est créé inactif et « à vérifier » : validez-le ensuite pour
        pouvoir l&apos;activer. Les distances se recalculent automatiquement au
        premier routage ou via <code>pnpm distances:rebuild</code>.
      </p>
    </section>
  );
}
