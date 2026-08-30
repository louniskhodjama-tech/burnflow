import Link from "next/link";
import { requireActor } from "@/lib/auth";

export const metadata = { title: "Plus — Régulation" };

const ITEMS = [
  { href: "/regulation/utilisateurs", title: "Utilisateurs et codes d'accès", desc: "Créer des comptes, générer des codes à transmettre oralement, désactiver." },
  { href: "/regulation/seuils", title: "Seuils et paramètres", desc: "Seuils cliniques et paramètres de routage, versionnés." },
  { href: "/regulation/rapports", title: "Rapports et audit", desc: "Rapport de situation, export CSV du journal d'audit." },
];

export default async function PlusPage() {
  await requireActor("regulateur");
  return (
    <div className="flex flex-col gap-2 pb-6">
      <h1 className="pt-2 text-lg font-semibold">Plus</h1>
      {ITEMS.map((i) => (
        <Link key={i.href} href={i.href} className="card block active:bg-bg">
          <div className="text-[16px] font-semibold">{i.title}</div>
          <p className="text-[13px] text-muted">{i.desc}</p>
        </Link>
      ))}
    </div>
  );
}
