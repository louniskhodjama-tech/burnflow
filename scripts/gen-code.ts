import "./_env";
import { eq } from "drizzle-orm";
import { db } from "../src/db";
import { accessCodes, users } from "../src/db/schema";
import { generateAccessCode, sha256 } from "../src/lib/crypto";

/**
 * Génère un code d'accès pour un utilisateur, directement depuis le serveur.
 * Voie de secours documentée au RUNBOOK : l'auth est par codes uniquement,
 * ce script évite tout verrouillage (ex. plus aucun régulateur connecté).
 *
 * Usage :
 *   pnpm gen:code <email> [n] [jours]  # n codes (défaut 1), validité en jours (défaut 7)
 *   pnpm gen:code --list               # liste les comptes actifs
 * Les codes sont personnels et réutilisables jusqu'à expiration (D-013).
 */
async function main() {
  const arg = process.argv[2];
  if (!arg || arg === "--help") {
    console.log("Usage : pnpm gen:code <email> [n]   |   pnpm gen:code --list");
    process.exit(arg ? 0 : 1);
  }

  if (arg === "--list") {
    const all = await db
      .select({ email: users.email, name: users.displayName, role: users.role, active: users.active })
      .from(users);
    for (const u of all) {
      console.log(`${(u.email ?? "(sans email)").padEnd(30)} ${u.role.padEnd(12)} ${u.active ? "" : "· DÉSACTIVÉ"} ${u.name}`);
    }
    process.exit(0);
  }

  const count = Math.min(Math.max(Number(process.argv[3] ?? 1) || 1, 1), 20);
  const days = Math.min(Math.max(Number(process.argv[4] ?? 7) || 7, 1), 30);
  const user = (
    await db.select().from(users).where(eq(users.email, arg.toLowerCase())).limit(1)
  )[0];
  if (!user) {
    console.error(`Aucun compte avec l'email ${arg}. Voir : pnpm gen:code --list`);
    process.exit(1);
  }
  if (!user.active) {
    console.error(`Le compte ${arg} est désactivé.`);
    process.exit(1);
  }

  console.log(`Codes pour ${user.displayName} (${user.role}) — ${days} jour(s), réutilisables :`);
  for (let i = 0; i < count; i++) {
    const code = generateAccessCode();
    await db.insert(accessCodes).values({
      codeHash: sha256(code),
      userId: user.id,
      createdBy: user.id,
      expiresAt: new Date(Date.now() + days * 24 * 3600 * 1000),
    });
    console.log(`  ${code.slice(0, 4)}-${code.slice(4)}`);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
