import Link from "next/link";
import { requireActor } from "@/lib/auth";
import { RoleNav } from "@/components/nav";
import { PushManager } from "@/components/push-manager";

const ROLE_LABELS: Record<string, string> = {
  urgentiste: "Urgentiste",
  referent: "Référent hôpital",
  regulateur: "Régulateur",
  brulologue: "Brûlologue",
};

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const actor = await requireActor();

  return (
    <div className="min-h-dvh pb-20">
      <header className="sticky top-0 z-20 border-b border-line bg-card">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-2 px-3 py-2">
          <Link href="/" className="min-h-0 text-[13px] font-semibold uppercase tracking-wider text-muted">
            Triage brûlés
          </Link>
          <div className="flex items-center gap-2">
            <span
              className="max-w-[45vw] truncate rounded-md bg-bg px-2 py-1 text-xs font-medium text-ink"
              title={`${actor.displayName} — ${ROLE_LABELS[actor.role]}`}
            >
              {actor.displayName}
              <span className="text-muted">
                {" · "}
                {ROLE_LABELS[actor.role]}
                {actor.isAdmin ? " · admin" : ""}
              </span>
            </span>
            <form action="/logout" method="post">
              <button
                className="min-h-0 rounded-md border border-line bg-white px-2 py-1 text-xs text-muted"
                type="submit"
              >
                Quitter
              </button>
            </form>
          </div>
        </div>
      </header>
      <PushManager vapidKey={process.env.VAPID_PUBLIC_KEY ?? null} />
      <main className="mx-auto max-w-2xl px-3 pt-2">{children}</main>
      <RoleNav role={actor.role} />
    </div>
  );
}
