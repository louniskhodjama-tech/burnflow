"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Role } from "@/lib/policy";

const NAV: Record<Role, { href: string; label: string; exact?: boolean }[]> = {
  urgentiste: [
    { href: "/patients", label: "Patients", exact: true },
    { href: "/patients/new", label: "+ Patient" },
  ],
  referent: [
    { href: "/hopital", label: "Capacité", exact: true },
    { href: "/hopital/demandes", label: "Demandes" },
    { href: "/hopital/attendus", label: "Attendus" },
  ],
  regulateur: [
    { href: "/regulation", label: "Tableau", exact: true },
    { href: "/regulation/demandes", label: "Demandes" },
    { href: "/regulation/sites", label: "Sites" },
    { href: "/regulation/plus", label: "Plus" },
  ],
  brulologue: [
    { href: "/avis", label: "File", exact: true },
    { href: "/avis/mes", label: "Mes avis" },
  ],
};

export function RoleNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = NAV[role];

  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-card pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex max-w-2xl">
        {items.map((item) => {
          const active = item.exact
            ? pathname === item.href
            : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex min-h-12 flex-1 items-center justify-center px-2 text-[13px] font-medium ${
                active ? "text-ink underline underline-offset-8" : "text-muted"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
