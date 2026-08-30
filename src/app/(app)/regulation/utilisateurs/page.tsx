import { asc, eq, inArray, max } from "drizzle-orm";
import { db } from "@/db";
import { auditLog, memberships, sites, users } from "@/db/schema";
import { requireActor } from "@/lib/auth";
import { NewUserForm, UserRow } from "./user-forms";

export const metadata = { title: "Utilisateurs — Régulation" };
export const dynamic = "force-dynamic";

export default async function UsersPage() {
  await requireActor("regulateur");

  const allUsers = await db.select().from(users).orderBy(asc(users.role), asc(users.displayName));
  const allMemberships = await db
    .select({
      userId: memberships.userId,
      siteId: memberships.siteId,
      siteName: sites.name,
    })
    .from(memberships)
    .innerJoin(sites, eq(sites.id, memberships.siteId));
  // Dernière connexion : depuis le journal d'audit (immuable), pas depuis les
  // sessions vivantes (supprimées à la déconnexion).
  const lastLogins = await db
    .select({
      userId: auditLog.userId,
      lastAt: max(auditLog.createdAt),
    })
    .from(auditLog)
    .where(inArray(auditLog.action, ["login.code", "login.magic_link"]))
    .groupBy(auditLog.userId);
  const lastByUser = new Map(lastLogins.map((l) => [l.userId, l.lastAt]));

  const allSites = await db
    .select({ id: sites.id, name: sites.name, kind: sites.kind })
    .from(sites)
    .orderBy(asc(sites.kind), asc(sites.name));

  const sitesByUser = new Map<string, string[]>();
  for (const m of allMemberships) {
    const list = sitesByUser.get(m.userId) ?? [];
    list.push(m.siteName);
    sitesByUser.set(m.userId, list);
  }

  return (
    <div className="flex flex-col gap-2 pb-6">
      <h1 className="pt-2 text-lg font-semibold">Utilisateurs</h1>
      <NewUserForm
        siteOptions={allSites.map((s) => ({
          id: s.id,
          label: `${s.kind === "triage_point" ? "PM · " : s.kind === "burn_center" ? "★ " : "H · "}${s.name}`,
          kind: s.kind,
        }))}
      />
      <section className="card">
        <h2 className="card-title">Comptes ({allUsers.length})</h2>
        <ul className="flex flex-col gap-2">
          {allUsers.map((u) => (
            <UserRow
              key={u.id}
              user={{
                id: u.id,
                displayName: u.displayName,
                email: u.email,
                role: u.role,
                isAdmin: u.isAdmin,
                active: u.active,
                siteNames: sitesByUser.get(u.id) ?? [],
                lastLoginAt: lastByUser.get(u.id)?.toISOString() ?? null,
              }}
            />
          ))}
        </ul>
      </section>
    </div>
  );
}
