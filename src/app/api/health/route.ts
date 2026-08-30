import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const checks: Record<string, string> = {};
  let ok = true;

  try {
    await db.execute(sql`select 1`);
    checks.database = "ok";
  } catch {
    checks.database = "erreur";
    ok = false;
  }

  const osrmUrl = process.env.OSRM_URL;
  if (osrmUrl) {
    try {
      const res = await fetch(
        `${osrmUrl}/route/v1/driving/3.086,36.737;3.087,36.738`,
        { signal: AbortSignal.timeout(3000) },
      );
      checks.osrm = res.ok ? "ok" : `http ${res.status}`;
    } catch {
      checks.osrm = "injoignable (estimation haversine utilisée)";
    }
  } else {
    checks.osrm = "non configuré";
  }

  return NextResponse.json(
    { status: ok ? "ok" : "degraded", checks, time: new Date().toISOString() },
    { status: ok ? 200 : 503 },
  );
}
