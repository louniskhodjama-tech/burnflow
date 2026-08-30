import "server-only";
import webpush from "web-push";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  memberships,
  notifications,
  pushSubscriptions,
  users,
} from "@/db/schema";
import { sendEmail } from "@/lib/email";
import type { Role } from "@/lib/policy";

let vapidConfigured = false;
function ensureVapid(): boolean {
  const pub = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  if (!pub || !priv) return false;
  if (!vapidConfigured) {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT ?? "mailto:admin@example.org",
      pub,
      priv,
    );
    vapidConfigured = true;
  }
  return true;
}

export type NotifInput = {
  kind: string;
  title: string;
  body: string;
  /** Chemin relatif ouvert au clic (ex. /hopital/demandes/xxx). */
  url?: string;
  relatedType?: string;
  relatedId?: string;
  /** Envoyer aussi par email (défaut true). */
  email?: boolean;
};

/** Notifie un utilisateur : push sur tous ses appareils + email + journal. */
export async function notifyUser(userId: string, n: NotifInput): Promise<void> {
  const user = (
    await db.select().from(users).where(eq(users.id, userId)).limit(1)
  )[0];
  if (!user || !user.active) return;

  // Push
  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  let pushError: string | null = subs.length === 0 ? "aucun abonnement" : null;
  if (ensureVapid()) {
    for (const sub of subs) {
      try {
        await webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth },
          },
          JSON.stringify({ title: n.title, body: n.body, url: n.url ?? "/" }),
          { TTL: 3600 },
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await db
            .delete(pushSubscriptions)
            .where(eq(pushSubscriptions.id, sub.id));
        } else {
          pushError = `push ${status ?? "erreur"}`;
        }
      }
    }
  } else if (subs.length > 0) {
    pushError = "VAPID non configuré";
  }
  await db.insert(notifications).values({
    userId,
    channel: "push",
    kind: n.kind,
    title: n.title,
    body: n.body,
    url: n.url ?? null,
    relatedType: n.relatedType ?? null,
    relatedId: n.relatedId ?? null,
    sentAt: pushError ? null : new Date(),
    error: pushError,
  });

  // Email
  if (n.email !== false && user.email) {
    const appUrl = process.env.APP_URL ?? "http://localhost:3000";
    const link = n.url ? `${appUrl}${n.url}` : appUrl;
    const ok = await sendEmail({
      to: user.email,
      subject: `[Triage brûlés] ${n.title}`,
      text: `${n.body}\n\nOuvrir : ${link}`,
    });
    await db.insert(notifications).values({
      userId,
      channel: "email",
      kind: n.kind,
      title: n.title,
      body: n.body,
      url: n.url ?? null,
      relatedType: n.relatedType ?? null,
      relatedId: n.relatedId ?? null,
      sentAt: ok ? new Date() : null,
      error: ok ? null : "envoi email en échec",
    });
  }
}

/** Notifie tous les utilisateurs actifs d'un rôle. */
export async function notifyRole(role: Role, n: NotifInput): Promise<void> {
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.role, role), eq(users.active, true)));
  await Promise.all(rows.map((r) => notifyUser(r.id, n)));
}

/** Notifie les référents d'un hôpital. */
export async function notifySiteReferents(
  siteId: string,
  n: NotifInput,
): Promise<void> {
  const rows = await db
    .select({ id: users.id })
    .from(memberships)
    .innerJoin(users, eq(users.id, memberships.userId))
    .where(
      and(
        eq(memberships.siteId, siteId),
        eq(users.role, "referent"),
        eq(users.active, true),
      ),
    );
  await Promise.all(rows.map((r) => notifyUser(r.id, n)));
}

/** Notifie plusieurs utilisateurs. */
export async function notifyUsers(userIds: string[], n: NotifInput): Promise<void> {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, unique));
  await Promise.all(rows.map((r) => notifyUser(r.id, n)));
}
