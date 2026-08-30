import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, isNull } from "drizzle-orm";
import { db } from "@/db";
import { magicLinks, users } from "@/db/schema";
import { clientIp, createSession, homeForRole } from "@/lib/auth";
import { sha256 } from "@/lib/crypto";
import { audit } from "@/lib/audit";
import type { Role } from "@/lib/policy";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const base = process.env.APP_URL ?? "http://localhost:3000";
  if (!token) return NextResponse.redirect(`${base}/login?error=lien`);

  const now = new Date();
  const link = (
    await db
      .select()
      .from(magicLinks)
      .where(
        and(
          eq(magicLinks.tokenHash, sha256(token)),
          isNull(magicLinks.usedAt),
          gt(magicLinks.expiresAt, now),
        ),
      )
      .limit(1)
  )[0];

  if (!link) return NextResponse.redirect(`${base}/login?error=lien`);

  // Usage unique — perdant si déjà consommé entre-temps.
  const updated = await db
    .update(magicLinks)
    .set({ usedAt: now })
    .where(and(eq(magicLinks.id, link.id), isNull(magicLinks.usedAt)))
    .returning({ id: magicLinks.id });
  if (updated.length === 0)
    return NextResponse.redirect(`${base}/login?error=lien`);

  const user = (
    await db
      .select()
      .from(users)
      .where(and(eq(users.email, link.email), eq(users.active, true)))
      .limit(1)
  )[0];
  if (!user) return NextResponse.redirect(`${base}/login?error=lien`);

  await createSession(user.id);
  await audit({
    userId: user.id,
    role: user.role,
    action: "login.magic_link",
    entityType: "magic_link",
    entityId: link.id,
    ip: await clientIp(),
  });
  return NextResponse.redirect(`${base}${homeForRole(user.role as Role)}`);
}
