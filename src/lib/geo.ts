/**
 * Coordonnées GPS — helpers purs (testés unitairement).
 * Le serveur borne déjà lat∈[18,38] / lng∈[−9,12] (siteSchema) ; côté client
 * on aide l'utilisateur : collage direct depuis Google Maps et détection de
 * l'inversion latitude/longitude (l'erreur classique qui fausserait tout le
 * routage).
 */

/** Emprise approximative de l'Algérie (marges comprises). */
export const ALGERIE = { latMin: 18, latMax: 38, lngMin: -9, lngMax: 12 };

export function enAlgerie(lat: number, lng: number): boolean {
  return (
    lat >= ALGERIE.latMin &&
    lat <= ALGERIE.latMax &&
    lng >= ALGERIE.lngMin &&
    lng <= ALGERIE.lngMax
  );
}

/** Vrai si les coordonnées sont hors zone mais valides une fois inversées. */
export function inversionProbable(lat: number, lng: number): boolean {
  return !enAlgerie(lat, lng) && enAlgerie(lng, lat);
}

const plausible = (lat: number, lng: number) =>
  Number.isFinite(lat) &&
  Number.isFinite(lng) &&
  Math.abs(lat) <= 90 &&
  Math.abs(lng) <= 180;

/**
 * Extrait « latitude, longitude » d'un texte collé : le format copié par
 * Google Maps (« 36.7538, 3.0588 »), une URL Google Maps (…@36.75,3.05,15z),
 * ou deux nombres séparés par un espace (virgule décimale acceptée).
 */
export function parseLatLng(
  input: string,
): { lat: number; lng: number } | null {
  const s = input.trim();
  if (!s) return null;

  const pair = /(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/.exec(s);
  if (pair) {
    const lat = Number(pair[1]);
    const lng = Number(pair[2]);
    if (plausible(lat, lng)) return { lat, lng };
  }

  const parts = s.split(/\s+/);
  if (parts.length === 2 && parts[0] && parts[1]) {
    const lat = Number(parts[0].replace(",", "."));
    const lng = Number(parts[1].replace(",", "."));
    if (plausible(lat, lng)) return { lat, lng };
  }

  return null;
}
