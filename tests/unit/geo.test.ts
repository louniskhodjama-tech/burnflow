import { describe, expect, it } from "vitest";
import { enAlgerie, inversionProbable, parseLatLng } from "@/lib/geo";

describe("parseLatLng — collage de coordonnées", () => {
  it("format copié par Google Maps", () => {
    expect(parseLatLng("36.7538, 3.0588")).toEqual({ lat: 36.7538, lng: 3.0588 });
    expect(parseLatLng("  36.75 ,3.05 ")).toEqual({ lat: 36.75, lng: 3.05 });
  });

  it("URL Google Maps", () => {
    expect(
      parseLatLng("https://www.google.com/maps/@36.7538,3.0588,15z"),
    ).toEqual({ lat: 36.7538, lng: 3.0588 });
  });

  it("deux nombres séparés par un espace, virgule décimale acceptée", () => {
    expect(parseLatLng("36,7538 3,0588")).toEqual({ lat: 36.7538, lng: 3.0588 });
    expect(parseLatLng("36.75 5.06")).toEqual({ lat: 36.75, lng: 5.06 });
  });

  it("rejette le bruit", () => {
    expect(parseLatLng("")).toBeNull();
    expect(parseLatLng("EPH Jijel")).toBeNull();
    expect(parseLatLng("999, 999")).toBeNull();
  });
});

describe("emprise Algérie et inversion", () => {
  it("Alger est en Algérie, l'inverse non", () => {
    expect(enAlgerie(36.75, 3.06)).toBe(true);
    expect(enAlgerie(3.06, 36.75)).toBe(false);
  });

  it("détecte l'inversion lat/lng", () => {
    expect(inversionProbable(3.06, 36.75)).toBe(true);
    expect(inversionProbable(36.75, 3.06)).toBe(false);
    expect(inversionProbable(48.85, 2.35)).toBe(false); // Paris : hors zone, pas une inversion
  });
});
