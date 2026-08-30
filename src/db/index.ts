import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  var __dbPool: Pool | undefined;
}

const connectionString =
  process.env.DATABASE_URL ?? "postgres://triage:triage@localhost:5433/triage";

// Pool unique, y compris à travers les rechargements du serveur de dev.
// - connectionTimeoutMillis : échouer vite plutôt que pendre si la base est injoignable ;
// - ssl : les Postgres managés fournissent souvent sslmode=require au sens libpq
//   (chiffré, sans vérification de CA) — node-pg, lui, vérifie strictement par
//   défaut ; on aligne sur la sémantique libpq quand l'URL le demande.
const pool =
  globalThis.__dbPool ??
  new Pool({
    connectionString,
    max: 10,
    connectionTimeoutMillis: 10_000,
    ssl: /sslmode=(require|no-verify)/.test(connectionString)
      ? { rejectUnauthorized: false }
      : undefined,
  });
globalThis.__dbPool = pool;

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
