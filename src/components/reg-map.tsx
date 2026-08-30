"use client";

import dynamic from "next/dynamic";

export type MapSite = {
  id: string;
  name: string;
  kind: "triage_point" | "hospital" | "burn_center";
  lat: number;
  lng: number;
  icuFree: number | null;
  wardFree: number | null;
  stale: boolean;
};

const MapInner = dynamic(() => import("./reg-map-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-72 items-center justify-center rounded-xl border border-line bg-bg text-sm text-muted">
      Chargement de la carte…
    </div>
  ),
});

export function RegMap({ sites }: { sites: MapSite[] }) {
  return <MapInner sites={sites} />;
}
