"use server";

import { redirect } from "next/navigation";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { accessCodes, magicLinks, users } from "@/db/schema";
import { clientIp, createSession, homeForRole } from "@/lib/auth";
import { normalizeAccessCode, randomToken, sha256 } from "@/lib/crypto";
import { sendEmail } from "@/lib/email";
import { rateLimitOk } from "@/lib/rate-limit";
import { audit } from "@/lib/audit";
import type { Role } from "@/lib/policy";

const MAGIC_LINK_MINUTES = 15;

export async function requestMagicLink(formData: FormData): Promise<void> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  if (!email || !email.includes("@")) redirect("/login?error=email");

  const ip = await clientIp();
  if (!rateLimitOk(`magic:${ip}`) || !rateLimitOk(`magic:${email}`)) {
    redirect("/login?error=limite");
  }

  const user = (
    await db
      .select()
      .from(users)
      .where(and(eq(users.email, email), eq(users.active, true)))
      .limit(1)
  )[0];

  // Réponse identique que l'utilisateur existe ou non (pas d'énumération).
  if (user) {
    const token = randomToken();
    await db.insert(magicLinks).values({
      email,
      tokenHash: sha256(token),
      expiresAt: new Date(Date.now() + MAGIC_LINK_MINUTES * 60 * 1000),
    });
    const url = `${process.env.APP_URL ?? "http://localhost:3000"}/auth/verify?token=${token}`;
    await sendEmail({
      to: email,
      subject: "Connexion — Triage brûlés",
      text: `Lien de connexion (valable ${MAGIC_LINK_MINUTES} minutes, usage unique) :\n\n${url}\n\nSi vous n'êtes pas à l'origine de cette demande, ignorez ce message.`,
      html: `<p>Lien de connexion (valable ${MAGIC_LINK_MINUTES} minutes, usage unique) :</p><p><a href="${url}">Se connecter à Triage brûlés</a></p><p style="color:#5b6b78">Si vous n'êtes pas à l'origine de cette demande, ignorez ce message.</p>`,
    });
  }

  redirect("/login?sent=1");
}

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
