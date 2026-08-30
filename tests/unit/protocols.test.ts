import { describe, it, expect } from "vitest";
import { careItemKey, protocolsForClass } from "@/lib/protocols";
import { DEFAULT_PROTOCOLS } from "@/lib/rules-defaults";

describe("conduite à tenir — filtrage par classe", () => {
  it("chaque classe reçoit ses sections, dans l'ordre", () => {
    const c1 = protocolsForClass(DEFAULT_PROTOCOLS, 1).map((s) => s.id);
    const c2 = protocolsForClass(DEFAULT_PROTOCOLS, 2).map((s) => s.id);
    expect(c1).toEqual(["analgesie", "atb-tetanos", "pansements"]);
    expect(c2).toEqual([
      "remplissage",
      "analgesie",
      "atb-tetanos",
      "pansements",
      "vigilance-transfert",
    ]);
    expect(protocolsForClass(DEFAULT_PROTOCOLS, 3)).toHaveLength(5);
  });

  it("config absente → aucune section, pas de crash", () => {
    expect(protocolsForClass(undefined, 2)).toEqual([]);
  });

  it("contenu par défaut : garde-fous cliniques présents", () => {
    const atb = DEFAULT_PROTOCOLS.find((s) => s.id === "atb-tetanos")!;
    expect(atb.content).toContain("large spectre");
    expect(atb.content).toContain("SAT/VAT");
    const pans = DEFAULT_PROTOCOLS.find((s) => s.id === "pansements")!;
    expect(pans.content).toContain("JAMAIS");
    expect(pans.items.length).toBeGreaterThanOrEqual(4);
  });

  it("clé d'élément stable", () => {
    expect(careItemKey("pansements", 2)).toBe("pansements:2");
  });
});
