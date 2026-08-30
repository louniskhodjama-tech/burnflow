"use server";

import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { accessCodes, users } from "@/db/schema";
import { clientIp, createSession, homeForRole } from "@/lib/auth";
import { normalizeAccessCode, sha256 } from "@/lib/crypto";
import { rateLimitOk } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import type { Role } from "@/lib/policy";

/**
 * Authentification par code d'accès uniquement (décision utilisateur,
 * DECISIONS D-012) : le lien magique par email a été retiré.
 */
export async function loginWithCode(formData: FormData): Promise<void> {
  const code = normalizeAccessCode(String(formData.get("code") ?? ""));
  if (code.length !== 8) redirect("/login?error=code");

  const ip = await clientIp();
  if (!rateLimitOk(`code:${ip}`)) redirect("/login?error=limite");

  const now = new Date();
  const row = (
    await db
      .select({
        id: accessCodes.id,
        userId: accessCodes.userId,
        role: users.role,
        active: users.active,
      })
      .from(accessCodes)
      .innerJoin(users, eq(users.id, accessCodes.userId))
      .where(
        and(
          eq(accessCodes.codeHash, sha256(code)),
          isNull(accessCodes.usedAt),
          gt(accessCodes.expiresAt, now),
        ),
      )
      .limit(1)
  )[0];

  if (!row || !row.active) redirect("/login?error=code");

  // Usage unique : marqué utilisé de façon atomique (perdant si déjà pris).
  const updated = await db
    .update(accessCodes)
    .set({ usedAt: now })
    .where(and(eq(accessCodes.id, row.id), isNull(accessCodes.usedAt)))
    .returning({ id: accessCodes.id });
  if (updated.length === 0) redirect("/login?error=code");

  await createSession(row.userId);
  await audit({
    userId: row.userId,
    role: row.role,
    action: "login.code",
    entityType: "access_code",
    entityId: row.id,
    ip,
  });
  redirect(homeForRole(row.role as Role));
}
