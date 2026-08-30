/**
 * Conduite à tenir — helpers purs (testés unitairement).
 */

import type { ProtocolSection } from "@/db/schema";

/** Sections applicables à une classe d'orientation, dans l'ordre de la config. */
export function protocolsForClass(
  sections: ProtocolSection[] | undefined,
  klass: 1 | 2 | 3,
): ProtocolSection[] {
  return (sections ?? []).filter((s) => s.classes.includes(klass));
}

/** Clé stable d'un élément cochable (le libellé est figé en copie à l'enregistrement). */
export function careItemKey(sectionId: string, index: number): string {
  return `${sectionId}:${index}`;
}
