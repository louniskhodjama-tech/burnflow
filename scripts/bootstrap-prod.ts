import "./_env";
import { eq } from "drizzle-orm";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { db } from "../src/db";
import { accessCodes, rulesConfig, users } from "../src/db/schema";
import { generateAccessCode, sha256 } from "../src/lib/crypto";
import { DEFAULT_RULES } from "../src/lib/rules-defaults";

/**
 * Amorçage d'un déploiement de production (base vide) :
 *   DATABASE_URL=<prod> pnpm tsx scripts/bootstrap-prod.ts <email> <nom affiché…>
 * - applique les migrations ;
 * - insère la configuration des règles v1 (valeurs du prototype validé) ;
 * - crée (ou réactive) le premier compte RÉGULATEUR admin ;
 * - génère son code d'accès personnel (7 jours, réutilisable) — affiché UNE fois.
 * Idempotent : réexécutable sans dégât.
 */
async function main() {
  const email = process.argv[2]?.toLowerCase();
  const displayName = process.argv.slice(3).join(" ").trim();
  if (!email || !email.includes("@") || !displayName) {
    console.error("Usage : DATABASE_URL=<prod> pnpm tsx scripts/bootstrap-prod.ts <email> <nom affiché…>");
    process.exit(1);
  }

  console.log("Migrations…");
  await migrate(db, { migrationsFolder: "drizzle" });
  console.log("  migrations appliquées");

  const hasRules = (await db.select().from(rulesConfig).limit(1)).length > 0;
  if (!hasRules) {
    await db.insert(rulesConfig).values({
      config: DEFAULT_RULES,
      comment: "Valeurs initiales (prototype validé)",
    });
    console.log("  rules_config v1 insérée");
  }

  let user = (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];
  if (!user) {
    user = (
      await db
        .insert(users)
        .values({ email, displayName, role: "regulateur", isAdmin: true, active: true })
        .returning()
    )[0]!;
    console.log(`  régulateur admin créé : ${displayName} <${email}>`);
  } else {
    await db.update(users).set({ active: true }).where(eq(users.id, user.id));
    console.log(`  compte existant réactivé : ${email}`);
  }

  const code = generateAccessCode();
  await db.insert(accessCodes).values({
    codeHash: sha256(code),
    userId: user.id,
    createdBy: user.id,
    expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
  });
  console.log("");
  console.log(`Code d'accès régulateur (7 jours, réutilisable) : ${code.slice(0, 4)}-${code.slice(4)}`);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
