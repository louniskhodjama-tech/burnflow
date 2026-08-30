import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * Garde-fou D-019 : un fichier « "use server" » ne peut exporter QUE des
 * fonctions async. Tout autre export (const, tableau, classe…) fait rejeter
 * le module entier par Next EN PRODUCTION au moment de résoudre l'action —
 * chaque soumission de formulaire du module explose alors avec un digest
 * opaque, alors que le build et le dev passent. Vécu en production le
 * 30/08/2026 (création de compte impossible) via
 * `export const CODE_DURATIONS_H` dans regulation/actions.ts.
 */

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.(ts|tsx)$/.test(entry)) out.push(p);
  }
  return out;
}

describe("fichiers « use server »", () => {
  it("n'exportent que des fonctions async", () => {
    const offenders: string[] = [];
    for (const file of walk("src")) {
      const src = readFileSync(file, "utf8");
      if (!/^\s*["']use server["'];?\s*$/m.test(src.slice(0, 300))) continue;
      src.split("\n").forEach((line, i) => {
        if (/^export\s+(const|let|var|enum|class|default|function\s)/.test(line))
          offenders.push(`${file}:${i + 1} → ${line.trim().slice(0, 80)}`);
      });
    }
    expect(offenders, offenders.join("\n")).toEqual([]);
  });
});
