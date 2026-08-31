"use client";

import { useEffect, useState } from "react";
import L from "leaflet";
import {
  CircleMarker,
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { enAlgerie, inversionProbable, parseLatLng } from "@/lib/geo";
import type { CoordPickerProps } from "./coord-picker";

/** Épingle sans image embarquée (les icônes par défaut de Leaflet cassent au bundling). */
const pinIcon = L.divIcon({
  className: "",
  html: '<div style="font-size:30px;line-height:30px;transform:translate(-50%,-92%);text-shadow:0 1px 2px rgba(0,0,0,.4)">📍</div>',
  iconSize: [0, 0],
});

const DEFAUT: [number, number] = [36.5, 5.5]; // nord-est algérien

function num(s: string): number | null {
  const n = Number(s.replace(",", "."));
  return Number.isFinite(n) && s.trim() !== "" ? n : null;
}

/** Pose l'épingle au tap sur la carte. */
function ClickSetter({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click: (e) => onPick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

/** Recentre la carte quand des coordonnées valides arrivent (collage, GPS, saisie). */
function Recenter({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMap();
  useEffect(() => {
    if (lat != null && lng != null && enAlgerie(lat, lng)) {
      map.setView([lat, lng], Math.max(map.getZoom(), 13));
    }
  }, [lat, lng, map]);
  return null;
}

export default function CoordPickerInner({ lat, lng, onChange }: CoordPickerProps) {
  const [paste, setPaste] = useState("");
  const [geoBusy, setGeoBusy] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);

  const nLat = num(lat);
  const nLng = num(lng);
  const valid = nLat != null && nLng != null;
  const horsZone = valid && !enAlgerie(nLat, nLng);
  const inversee = valid && inversionProbable(nLat, nLng);

  const set = (a: number, b: number) => onChange(a.toFixed(5), b.toFixed(5));

  const maPosition = () => {
    setGeoError(null);
    if (!("geolocation" in navigator)) {
      setGeoError("Géolocalisation indisponible sur cet appareil.");
      return;
    }
    setGeoBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoBusy(false);
        set(pos.coords.latitude, pos.coords.longitude);
      },
      (err) => {
        setGeoBusy(false);
        setGeoError(
          err.code === err.PERMISSION_DENIED
            ? "Permission refusée — autorisez la localisation pour ce site."
            : "Position introuvable — réessayez à découvert.",
        );
      },
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-2">
        <button
          type="button"
          className="btn-base shrink-0 px-3 text-[14px]"
          disabled={geoBusy}
          onClick={maPosition}
        >
          {geoBusy ? "…" : "📍 Ma position"}
        </button>
        <input
          className="input-base min-w-0 flex-1"
          placeholder="Coller « 36.7538, 3.0588 » ou un lien Google Maps"
          value={paste}
          onChange={(e) => {
            setPaste(e.target.value);
            const p = parseLatLng(e.target.value);
            if (p) {
              set(p.lat, p.lng);
              setPaste("");
            }
          }}
        />
      </div>
      {geoError && <p className="text-xs text-centre">{geoError}</p>}

      <div className="flex gap-2">
        <input
          className="input-base"
          placeholder="Latitude (ex. 36.75)"
          inputMode="decimal"
          value={lat}
          onChange={(e) => onChange(e.target.value, lng)}
        />
        <input
          className="input-base"
          placeholder="Longitude (ex. 5.06)"
          inputMode="decimal"
          value={lng}
          onChange={(e) => onChange(lat, e.target.value)}
        />
      </div>

      {horsZone && (
        <p className="rounded-lg border border-centre bg-centre/5 px-2 py-1.5 text-[13px] text-centre">
          Ces coordonnées tombent hors d&apos;Algérie.
          {inversee && (
            <>
              {" "}
              Latitude et longitude semblent inversées —{" "}
              <button
                type="button"
                className="min-h-0 font-semibold underline"
                onClick={() => nLat != null && nLng != null && set(nLng, nLat)}
              >
                inverser ?
              </button>
            </>
          )}
        </p>
      )}

      <div>
        <MapContainer
          center={valid && !horsZone ? [nLat, nLng] : DEFAUT}
          zoom={valid && !horsZone ? 13 : 6}
          className="z-0 h-56 w-full rounded-xl border border-line"
          scrollWheelZoom={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <ClickSetter onPick={set} />
          <Recenter lat={nLat} lng={nLng} />
          {valid && !horsZone && (
            <>
              <Marker
                position={[nLat, nLng]}
                icon={pinIcon}
                draggable
                eventHandlers={{
                  dragend: (e) => {
                    const p = (e.target as L.Marker).getLatLng();
                    set(p.lat, p.lng);
                  },
                }}
              />
              <CircleMarker
                center={[nLat, nLng]}
                radius={3}
                interactive={false}
                pathOptions={{ color: "#b23a48", fillColor: "#b23a48", fillOpacity: 1 }}
              />
            </>
          )}
        </MapContainer>
        <p className="mt-1 text-xs text-muted">
          Touchez la carte pour poser l&apos;épingle, faites-la glisser pour
          l&apos;affiner sur le bon bâtiment — les champs se remplissent seuls.
        </p>
      </div>
    </div>
  );
}
