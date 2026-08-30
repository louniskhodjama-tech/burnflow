import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

declare global {
  var __dbPool: Pool | undefined;
}

// Pool unique, y compris à travers les rechargements du serveur de dev.
const pool =
  globalThis.__dbPool ??
  new Pool({
    connectionString:
      process.env.DATABASE_URL ??
      "postgres://triage:triage@localhost:5433/triage",
    max: 10,
  });
globalThis.__dbPool = pool;

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
