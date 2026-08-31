"use client";

import dynamic from "next/dynamic";

export type CoordPickerProps = {
  lat: string;
  lng: string;
  onChange: (lat: string, lng: string) => void;
};

const Inner = dynamic(() => import("./coord-picker-inner"), {
  ssr: false,
  loading: () => (
    <div className="flex h-56 items-center justify-center rounded-xl border border-line bg-bg text-sm text-muted">
      Chargement de la carte…
    </div>
  ),
});

/** Saisie de coordonnées GPS : position du téléphone, épingle sur carte, ou collage Google Maps. */
export function CoordPicker(props: CoordPickerProps) {
  return <Inner {...props} />;
}
