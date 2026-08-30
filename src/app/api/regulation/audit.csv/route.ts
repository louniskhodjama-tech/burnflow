import { NextResponse } from "next/server";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { auditLog } from "@/db/schema";
import { getActor } from "@/lib/auth";
import { can } from "@/lib/policy";

export const dynamic = "force-dynamic";

function csvCell(v: unknown): string {
  if (v == null) return "";
  const s = typeof v === "string" ? v : JSON.stringify(v);
  return `"${s.replace(/"/g, '""')}"`;
}

export async function GET() {
  const actor = await getActor();
  if (!actor || !can.exportAudit(actor))
    return NextResponse.json({ error: "accès refusé" }, { status: 403 });

  const rows = await db
    .select()
    .from(auditLog)
    .orderBy(asc(auditLog.id))
    .limit(100_000);

  const header = "id;date;user_id;role;action;entity_type;entity_id;before;after;ip";
  const lines = rows.map((r) =>
    [
      r.id,
      new Date(r.createdAt).toISOString(),
      r.userId ?? "",
      r.role ?? "",
      r.action,
      r.entityType,
      r.entityId ?? "",
      csvCell(r.before),
      csvCell(r.after),
      r.ip ?? "",
    ].join(";"),
  );
  const csv = "﻿" + [header, ...lines].join("\r\n");

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="audit-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}
