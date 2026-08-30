import "./_env";
import fs from "node:fs";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { sites } from "../src/db/schema";

/**
 * Import de sites depuis un CSV (voir data/sites.template.csv).
 * Usage : pnpm seed:sites data/sites.east-draft.csv
 * Idempotent : la clé est le nom exact — un site existant n'est pas modifié.
 * Tous les sites importés arrivent INACTIFS ; ceux marqués to_verify=true
 * doivent être vérifiés par le régulateur dans l'interface avant activation.
 */

const KINDS = new Set(["triage_point", "hospital", "burn_center"]);

async function main() {
  const file = process.argv[2];
  if (!file) {
    console.error("Usage : pnpm seed:sites <fichier.csv>");
    process.exit(1);
  }
  const raw = fs.readFileSync(file, "utf8");
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));

  const header = lines.shift();
  const expected = "kind;name;wilaya;lat;lng;phone;to_verify";
  if (header !== expected) {
    console.error(`En-tête inattendu.\n  attendu : ${expected}\n  reçu    : ${header}`);
    process.exit(1);
  }

  let created = 0;
  let skipped = 0;
  let invalid = 0;
  for (const [i, line] of lines.entries()) {
    const cols = line.split(";").map((c) => c.trim());
    const [kind, name, wilaya, latS, lngS, phone, toVerifyS] = cols;
    const lat = Number(latS);
    const lng = Number(lngS);
    if (
      !kind || !KINDS.has(kind) || !name || !wilaya ||
      !Number.isFinite(lat) || !Number.isFinite(lng) ||
      lat < 18 || lat > 38 || lng < -9 || lng > 12
    ) {
      console.warn(`ligne ${i + 2} ignorée (invalide) : ${line}`);
      invalid++;
      continue;
    }
    const existing = (
      await db.select({ id: sites.id }).from(sites).where(eq(sites.name, name)).limit(1)
    )[0];
    if (existing) {
      skipped++;
      continue;
    }
    await db.insert(sites).values({
      kind: kind as "triage_point" | "hospital" | "burn_center",
      name,
      wilaya,
      lat,
      lng,
      phone: phone || null,
      active: false,
      toVerify: toVerifyS !== "false",
    });
    created++;
  }

  console.log(
    `Import terminé : ${created} créé(s), ${skipped} déjà présent(s), ${invalid} invalide(s).`,
  );
  console.log(
    "→ Le régulateur doit vérifier puis activer ces sites dans /regulation/sites.",
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
