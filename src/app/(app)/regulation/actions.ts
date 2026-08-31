"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  accessCodes,
  memberships,
  rulesConfig,
  sites,
  users,
} from "@/db/schema";
import { clientIp, requireActor } from "@/lib/auth";
import { can } from "@/lib/policy";
import { audit } from "@/lib/audit";
import { generateAccessCode, sha256 } from "@/lib/crypto";
import { forceTransfer, cancelTransfer } from "@/lib/transfers";
import { getCurrentRules } from "@/lib/rules";
import type { RulesJson } from "@/db/schema";

/* ============================ Transferts ============================ */

export async function forceTransferAction(
  requestId: string,
  targetSiteId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireActor("regulateur");
  const res = await forceTransfer(actor, requestId, targetSiteId, reason);
  revalidatePath(`/regulation/demandes/${requestId}`);
  revalidatePath("/regulation");
  return res;
}

export async function cancelTransferRegAction(
  requestId: string,
  reason: string,
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireActor("regulateur");
  const res = await cancelTransfer(actor, requestId, reason);
  revalidatePath(`/regulation/demandes/${requestId}`);
  return res;
}

/* ============================ Sites ============================ */

const siteSchema = z.object({
  kind: z.enum(["triage_point", "hospital", "burn_center"]),
  name: z.string().trim().min(3).max(200),
  wilaya: z.string().trim().min(2).max(100),
  lat: z.number().min(18).max(38),
  lng: z.number().min(-9).max(12),
  phone: z.string().trim().max(30).nullable(),
});

export async function createSiteAction(
  payload: z.infer<typeof siteSchema>,
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireActor("regulateur");
  if (!can.manageSites(actor)) return { ok: false, error: "Accès refusé." };
  const parsed = siteSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Champs invalides (coordonnées en Algérie requises)." };

  const inserted = await db
    .insert(sites)
    .values({ ...parsed.data, active: false, toVerify: true })
    .returning({ id: sites.id });
  await audit({
    userId: actor.userId,
    role: actor.role,
    action: "site.create",
    entityType: "site",
    entityId: inserted[0]!.id,
    after: parsed.data,
    ip: await clientIp(),
  });
  revalidatePath("/regulation/sites");
  return { ok: true };
}

export async function updateSiteAction(
  siteId: string,
  payload: Partial<z.infer<typeof siteSchema>> & {
    active?: boolean;
    toVerify?: boolean;
  },
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireActor("regulateur");
  if (!can.manageSites(actor)) return { ok: false, error: "Accès refusé." };

  const parsed = siteSchema
    .partial()
    .extend({ active: z.boolean().optional(), toVerify: z.boolean().optional() })
    .safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Champs invalides." };
  const patch = parsed.data;

  const before = (
    await db.select().from(sites).where(eq(sites.id, siteId)).limit(1)
  )[0];
  if (!before) return { ok: false, error: "Site introuvable." };

  // Ne jamais activer un site non vérifié (GOAL §Données hôpitaux).
  const willVerify = patch.toVerify ?? before.toVerify;
  const willActive = patch.active ?? before.active;
  if (willActive && willVerify)
    return { ok: false, error: "Vérifiez le site avant de l'activer." };

  await db
    .update(sites)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(sites.id, siteId));
  await audit({
    userId: actor.userId,
    role: actor.role,
    action: "site.update",
    entityType: "site",
    entityId: siteId,
    before: { active: before.active, toVerify: before.toVerify, name: before.name },
    after: patch,
    ip: await clientIp(),
  });
  revalidatePath("/regulation/sites");
  revalidatePath("/regulation");
  return { ok: true };
}

/* ============================ Utilisateurs & codes ============================ */

const userSchema = z.object({
  email: z.string().trim().toLowerCase().email().nullable(),
  displayName: z.string().trim().min(2).max(120),
  role: z.enum(["urgentiste", "referent", "regulateur", "brulologue"]),
  siteIds: z.array(z.string().uuid()).max(10),
});

export async function createUserAction(
  payload: z.infer<typeof userSchema>,
): Promise<{ ok: boolean; error?: string; userId?: string }> {
  const actor = await requireActor("regulateur");
  if (!can.manageUsers(actor)) return { ok: false, error: "Accès refusé." };
  const parsed = userSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: "Champs invalides." };
  const data = parsed.data;

  if (data.role === "referent" && data.siteIds.length !== 1)
    return { ok: false, error: "Un référent est rattaché à exactement un hôpital." };
  if (data.role === "urgentiste" && data.siteIds.length === 0)
    return { ok: false, error: "Un urgentiste doit avoir au moins un point médical." };

  try {
    const userId = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(users)
        .values({
          email: data.email,
          displayName: data.displayName,
          role: data.role,
          active: true,
        })
        .returning({ id: users.id });
      const id = inserted[0]!.id;
      for (const siteId of data.siteIds) {
        await tx.insert(memberships).values({ userId: id, siteId });
      }
      await audit(
        {
          userId: actor.userId,
          role: actor.role,
          action: "user.create",
          entityType: "user",
          entityId: id,
          after: { email: data.email, role: data.role, sites: data.siteIds.length },
        },
        tx,
      );
      return id;
    });
    revalidatePath("/regulation/utilisateurs");
    return { ok: true, userId };
  } catch (e) {
    const code = (e as { cause?: { code?: string }; code?: string });
    if (code.code === "23505" || code.cause?.code === "23505")
      return { ok: false, error: "Un compte existe déjà avec cet email." };
    throw e;
  }
}

export async function setUserActiveAction(
  userId: string,
  active: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireActor("regulateur");
  if (!can.manageUsers(actor)) return { ok: false, error: "Accès refusé." };
  if (userId === actor.userId && !active)
    return { ok: false, error: "Impossible de désactiver votre propre compte." };
  await db.update(users).set({ active }).where(eq(users.id, userId));
  await audit({
    userId: actor.userId,
    role: actor.role,
    action: active ? "user.activate" : "user.deactivate",
    entityType: "user",
    entityId: userId,
  });
  revalidatePath("/regulation/utilisateurs");
  return { ok: true };
}

/** Génère un code personnel (affiché UNE fois, stocké haché, réutilisable — D-013). */
export async function generateCodeAction(
  userId: string,
  hours: number,
): Promise<{ ok: boolean; error?: string; code?: string; expiresAt?: string }> {
  const actor = await requireActor("regulateur");
  if (!can.generateAccessCodes(actor)) return { ok: false, error: "Accès refusé." };
  const h = Math.min(Math.max(Math.round(hours) || 24, 1), 720);

  const target = (
    await db.select().from(users).where(eq(users.id, userId)).limit(1)
  )[0];
  if (!target || !target.active)
    return { ok: false, error: "Utilisateur introuvable ou désactivé." };

  const code = generateAccessCode();
  const expiresAt = new Date(Date.now() + h * 3600 * 1000);
  await db.insert(accessCodes).values({
    codeHash: sha256(code),
    userId,
    createdBy: actor.userId,
    expiresAt,
  });
  await audit({
    userId: actor.userId,
    role: actor.role,
    action: "access_code.generate",
    entityType: "user",
    entityId: userId,
    after: { validiteHeures: h },
    ip: await clientIp(),
  });
  return {
    ok: true,
    code: `${code.slice(0, 4)}-${code.slice(4)}`,
    expiresAt: expiresAt.toISOString(),
  };
}

/** Prolonge un code actif (depuis maintenant ou son échéance, la plus tardive). */
export async function extendCodeAction(
  codeId: string,
  hours: number,
): Promise<{ ok: boolean; error?: string; expiresAt?: string }> {
  const actor = await requireActor("regulateur");
  if (!can.generateAccessCodes(actor)) return { ok: false, error: "Accès refusé." };
  const h = Math.min(Math.max(Math.round(hours) || 24, 1), 720);

  const row = (
    await db.select().from(accessCodes).where(eq(accessCodes.id, codeId)).limit(1)
  )[0];
  if (!row || row.revokedAt) return { ok: false, error: "Code introuvable ou révoqué." };

  const base = Math.max(Date.now(), new Date(row.expiresAt).getTime());
  const expiresAt = new Date(base + h * 3600 * 1000);
  await db
    .update(accessCodes)
    .set({ expiresAt })
    .where(eq(accessCodes.id, codeId));
  await audit({
    userId: actor.userId,
    role: actor.role,
    action: "access_code.extend",
    entityType: "access_code",
    entityId: codeId,
    after: { prolongationHeures: h, expireLe: expiresAt.toISOString() },
    ip: await clientIp(),
  });
  revalidatePath("/regulation/utilisateurs");
  return { ok: true, expiresAt: expiresAt.toISOString() };
}

/** Révoque immédiatement un code (les sessions déjà ouvertes ne sont pas touchées). */
export async function revokeCodeAction(
  codeId: string,
): Promise<{ ok: boolean; error?: string }> {
  const actor = await requireActor("regulateur");
  if (!can.generateAccessCodes(actor)) return { ok: false, error: "Accès refusé." };

  const updated = await db
    .update(accessCodes)
    .set({ revokedAt: new Date() })
    .where(and(eq(accessCodes.id, codeId), isNull(accessCodes.revokedAt)))
    .returning({ id: accessCodes.id });
  if (updated.length === 0) return { ok: false, error: "Code introuvable ou déjà révoqué." };

  await audit({
    userId: actor.userId,
    role: actor.role,
    action: "access_code.revoke",
    entityType: "access_code",
    entityId: codeId,
    ip: await clientIp(),
  });
  revalidatePath("/regulation/utilisateurs");
  return { ok: true };
}

/* ============================ Seuils (rules_config) ============================ */

const rulesSchema = z.object({
  reaSCB: z.number().min(5).max(60),
  childBelow: z.number().min(0).max(18),
  elderlyAbove: z.number().min(30).max(100),
  thirdDegreeSign: z.number().min(0).max(50),
  parklandMlKgPct: z.number().min(1).max(10),
  routing: z.object({
    lambda: z.number().min(0).max(10),
    saturationThreshold: z.number().min(0.3).max(1),
    cascadeMax: z.number().int().min(1).max(10),
    timeoutMinutes: z.number().int().min(2).max(60),
    protectedCenters: z.boolean(),
    capacityStaleHours: z.number().min(1).max(48),
    adviceReleaseMinutes: z.number().int().min(5).max(120),
  }),
  protocols: z
    .array(
      z.object({
        id: z.string().regex(/^[a-z0-9-]{2,40}$/),
        title: z.string().trim().min(2).max(120),
        classes: z
          .array(z.union([z.literal(1), z.literal(2), z.literal(3)]))
          .min(1),
        content: z.string().trim().min(10).max(8000),
        items: z.array(z.string().trim().min(2).max(200)).max(20),
      }),
    )
    .max(20)
    .optional(),
});

export async function updateRulesAction(
  payload: RulesJson,
  comment: string,
): Promise<{ ok: boolean; error?: string; version?: number }> {
  const actor = await requireActor("regulateur");
  if (!can.updateRules(actor)) return { ok: false, error: "Accès refusé." };
  const parsed = rulesSchema.safeParse(payload);
  if (!parsed.success)
    return { ok: false, error: "Valeurs hors bornes : " + parsed.error.issues[0]?.message };

  const { version: previous } = await getCurrentRules();
  const inserted = await db
    .insert(rulesConfig)
    .values({
      config: parsed.data,
      comment: comment.trim() || null,
      createdBy: actor.userId,
    })
    .returning({ version: rulesConfig.version });
  await audit({
    userId: actor.userId,
    role: actor.role,
    action: "rules.update",
    entityType: "rules_config",
    entityId: String(inserted[0]!.version),
    before: { version: previous },
    after: parsed.data,
  });
  revalidatePath("/regulation/seuils");
  return { ok: true, version: inserted[0]!.version };
}
