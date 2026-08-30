"use client";

import { CircleMarker, MapContainer, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import type { MapSite } from "./reg-map";

const KIND_COLORS: Record<MapSite["kind"], string> = {
  triage_point: "#2f6fed",
  hospital: "#2e7d5b",
  burn_center: "#b23a48",
};

export default function RegMapInner({ sites }: { sites: MapSite[] }) {
  const center: [number, number] =
    sites.length > 0
      ? [
          sites.reduce((s, x) => s + x.lat, 0) / sites.length,
          sites.reduce((s, x) => s + x.lng, 0) / sites.length,
        ]
      : [36.5, 5.5];

  return (
    <MapContainer
      center={center}
      zoom={7}
      className="z-0 h-72 w-full rounded-xl border border-line"
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {sites.map((s) => (
        <CircleMarker
          key={s.id}
          center={[s.lat, s.lng]}
          radius={s.kind === "triage_point" ? 6 : 9}
          pathOptions={{
            color: s.stale ? "#5b6b78" : KIND_COLORS[s.kind],
            fillColor: s.stale ? "#5b6b78" : KIND_COLORS[s.kind],
            fillOpacity: s.kind === "triage_point" ? 0.5 : 0.8,
          }}
        >
          <Popup>
            <b>{s.name}</b>
            <br />
            {s.kind === "triage_point"
              ? "Point médical"
              : `${s.kind === "burn_center" ? "Centre des brûlés" : "Hôpital"} — réa ${s.icuFree ?? "?"} · hosp. ${s.wardFree ?? "?"}${s.stale ? " (capacité périmée)" : ""}`}
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
