import "server-only";
import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { and, eq, gt } from "drizzle-orm";
import { db } from "@/db";
import { memberships, sessions, users } from "@/db/schema";
import { randomToken, sha256 } from "@/lib/crypto";
import type { Actor, Role } from "@/lib/policy";

const COOKIE_NAME = "tb_session";
const SESSION_DAYS = 30;

export type SessionUser = Actor & {
  displayName: string;
  email: string | null;
};

export async function createSession(userId: string): Promise<void> {
  const token = randomToken();
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 24 * 3600 * 1000);
  const h = await headers();
  await db.insert(sessions).values({
    tokenHash: sha256(token),
    userId,
    expiresAt,
    userAgent: h.get("user-agent")?.slice(0, 300) ?? null,
  });
  const jar = await cookies();
  jar.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: (process.env.APP_URL ?? "").startsWith("https"),
    path: "/",
    maxAge: SESSION_DAYS * 24 * 3600,
  });
}

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, sha256(token)));
  }
  jar.delete(COOKIE_NAME);
}

/** Acteur courant (mémoïsé par requête). null si non connecté. */
export const getActor = cache(async (): Promise<SessionUser | null> => {
  const jar = await cookies();
  const token = jar.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const rows = await db
    .select({
      userId: users.id,
      role: users.role,
      isAdmin: users.isAdmin,
      active: users.active,
      displayName: users.displayName,
      email: users.email,
      sessionId: sessions.id,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(
      and(eq(sessions.tokenHash, sha256(token)), gt(sessions.expiresAt, new Date())),
    )
    .limit(1);

  const row = rows[0];
  if (!row || !row.active) return null;

  const sites = await db
    .select({ siteId: memberships.siteId })
    .from(memberships)
    .where(eq(memberships.userId, row.userId));

  return {
    userId: row.userId,
    role: row.role as Role,
    isAdmin: row.isAdmin,
    siteIds: sites.map((s) => s.siteId),
    displayName: row.displayName,
    email: row.email,
  };
});

/** Exige une session ; sinon redirection /login. */
export async function requireActor(...roles: Role[]): Promise<SessionUser> {
  const actor = await getActor();
  if (!actor) redirect("/login");
  if (roles.length > 0 && !roles.includes(actor.role)) redirect("/");
  return actor;
}

/** Page d'accueil selon le rôle. */
export function homeForRole(role: Role): string {
  switch (role) {
    case "urgentiste":
      return "/patients";
    case "referent":
      return "/hopital";
    case "regulateur":
      return "/regulation";
    case "brulologue":
      return "/avis";
  }
}

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (
    h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    h.get("x-real-ip") ??
    "local"
  );
}
