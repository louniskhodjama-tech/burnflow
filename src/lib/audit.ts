import { db, type Tx } from "@/db";
import { auditLog } from "@/db/schema";

export async function audit(
  entry: {
    userId?: string | null;
    role?: string | null;
    action: string;
    entityType: string;
    entityId?: string | null;
    before?: unknown;
    after?: unknown;
    ip?: string | null;
  },
  tx?: Tx,
): Promise<void> {
  const target = tx ?? db;
  await target.insert(auditLog).values({
    userId: entry.userId ?? null,
    role: entry.role ?? null,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    before: entry.before ?? null,
    after: entry.after ?? null,
    ip: entry.ip ?? null,
  });
}
