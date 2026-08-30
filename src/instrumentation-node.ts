/**
 * Démarrage du processus serveur Node :
 * - migrations SQL au boot (production : RUN_MIGRATIONS_ON_BOOT=1), avec
 *   nouvelles tentatives — une base injoignable 10 s au démarrage ne doit pas
 *   mettre le conteneur en boucle de crash ;
 * - jobs périodiques (expirations de cascade, relâche d'avis, relances,
 *   rapport 6 h), chacun blindé — un échec ponctuel se journalise, ne tue rien ;
 * - filets globaux : sur un outil de crise, la disponibilité prime — aucune
 *   promesse rejetée ni exception orpheline ne doit éteindre le serveur (D-017).
 * S'exécute une fois à l'import ; garde-fou global contre le double
 * enregistrement (rechargements du serveur de dev).
 */

import cron from "node-cron";

declare global {
  var __jobsStarted: boolean | undefined;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function migrateWithRetry(): Promise<void> {
  const { migrate } = await import("drizzle-orm/node-postgres/migrator");
  const { db } = await import("@/db");
  const ATTEMPTS = 5;
  for (let i = 1; i <= ATTEMPTS; i++) {
    try {
      await migrate(db, { migrationsFolder: "drizzle" });
      console.log("[boot] migrations appliquées");
      return;
    } catch (e) {
      console.error(`[boot] migrations, tentative ${i}/${ATTEMPTS} :`, e);
      if (i < ATTEMPTS) await sleep(5_000);
    }
  }
  // On sert plutôt que de crasher : le schéma est déjà à jour dans le cas
  // nominal (migrations idempotentes, réappliquées au prochain démarrage).
  console.error(
    "[boot] migrations non appliquées après plusieurs tentatives — le serveur démarre quand même",
  );
}

async function boot(): Promise<void> {
  if (globalThis.__jobsStarted) return;
  globalThis.__jobsStarted = true;

  process.on("unhandledRejection", (reason) => {
    console.error("[garde] promesse rejetée non gérée (absorbée) :", reason);
  });
  process.on("uncaughtException", (err) => {
    console.error("[garde] exception non rattrapée (absorbée) :", err);
  });

  if (process.env.RUN_MIGRATIONS_ON_BOOT === "1") {
    await migrateWithRetry();
  }

  const { minuteTick, remindStaleCapacities, sendSituationReport } = await import(
    "@/lib/jobs"
  );

  const safe = (name: string, fn: () => Promise<unknown>) => () => {
    void fn().catch((e) => console.error(`[cron] ${name} en échec (absorbé) :`, e));
  };

  cron.schedule("* * * * *", safe("minuteTick", minuteTick));
  cron.schedule("*/30 * * * *", safe("relanceCapacites", remindStaleCapacities));
  cron.schedule("0 */6 * * *", safe("rapport6h", sendSituationReport));
  console.log("[boot] jobs périodiques démarrés (1 min / 30 min / 6 h)");
}

boot().catch((e) => {
  console.error("[boot] échec du démarrage (absorbé, le serveur continue) :", e);
});
