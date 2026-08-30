import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  var __dbPool: Pool | undefined;
}

// Les Postgres managés fournissent souvent sslmode=require au sens libpq
// (chiffré, SANS vérification de CA) ; node-pg, lui, vérifie strictement et le
// paramètre d'URL prime sur la config. On retire donc sslmode de l'URL et on
// impose l'équivalent libpq via l'option ssl.
function poolConfig(raw: string) {
  let connectionString = raw;
  let ssl: { rejectUnauthorized: boolean } | undefined;
  const m = /[?&]sslmode=(require|no-verify|prefer)/.exec(raw);
  if (m) {
    ssl = { rejectUnauthorized: false };
    const url = new URL(raw);
    url.searchParams.delete("sslmode");
    connectionString = url.toString();
  }
  return { connectionString, ssl };
}

// Pool unique, y compris à travers les rechargements du serveur de dev.
// connectionTimeoutMillis : échouer vite plutôt que pendre si la base est injoignable.
const pool =
  globalThis.__dbPool ??
  new Pool({
    ...poolConfig(
      process.env.DATABASE_URL ?? "postgres://triage:triage@localhost:5433/triage",
    ),
    max: 10,
    connectionTimeoutMillis: 10_000,
    // Réseau managé : recycler vite les connexions au repos et sonder le TCP,
    // sinon une coupure silencieuse (NAT, redémarrage du Postgres managé)
    // laisse des clients morts dans le pool.
    idleTimeoutMillis: 30_000,
    keepAlive: true,
  });
globalThis.__dbPool = pool;
// Sans écouteur, l'erreur d'un client AU REPOS (connexion coupée par le
// réseau/serveur) est un événement 'error' non géré → crash du processus.
if (pool.listenerCount("error") === 0) {
  pool.on("error", (e) => {
    console.error("[db] connexion au repos perdue (absorbée) :", e.message);
  });
}

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
