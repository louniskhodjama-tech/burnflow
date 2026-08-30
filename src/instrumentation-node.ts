/**
 * Démarrage du processus serveur Node :
 * - migrations SQL au boot (production : RUN_MIGRATIONS_ON_BOOT=1) ;
 * - jobs périodiques (expirations de cascade, relâche d'avis, relances, rapport 6 h).
 * S'exécute une fois à l'import ; garde-fou global contre le double
 * enregistrement (rechargements du serveur de dev).
 */

import cron from "node-cron";

declare global {
  var __jobsStarted: boolean | undefined;
}

async function boot(): Promise<void> {
  if (process.env.RUN_MIGRATIONS_ON_BOOT === "1") {
    const { migrate } = await import("drizzle-orm/node-postgres/migrator");
    const { db } = await import("@/db");
    try {
      await migrate(db, { migrationsFolder: "drizzle" });
      console.log("[boot] migrations appliquées");
    } catch (e) {
      console.error("[boot] échec des migrations :", e);
      throw e;
    }
  }

  if (globalThis.__jobsStarted) return;
  globalThis.__jobsStarted = true;

  const { minuteTick, remindStaleCapacities, sendSituationReport } = await import(
    "@/lib/jobs"
  );

  cron.schedule("* * * * *", () => void minuteTick());
  cron.schedule("*/30 * * * *", () => void remindStaleCapacities());
  cron.schedule("0 */6 * * *", () => void sendSituationReport());
  console.log("[boot] jobs périodiques démarrés (1 min / 30 min / 6 h)");
}

void boot();
