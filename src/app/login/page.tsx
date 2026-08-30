import { redirect } from "next/navigation";
import { getActor, homeForRole } from "@/lib/auth";
import { loginWithCode } from "./actions";

export const metadata = { title: "Connexion — Triage brûlés" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const actor = await getActor();
  if (actor) redirect(homeForRole(actor.role));
  const { error } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-3 pb-16">
      <header className="px-1 pt-6 pb-2">
        <h1 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Triage brûlés · connexion
        </h1>
      </header>

      {error === "code" && (
        <Alert msg="Code invalide, expiré ou déjà utilisé. Demandez un nouveau code au régulateur." />
      )}
      {error === "limite" && (
        <Alert msg="Trop de tentatives. Réessayez dans quelques minutes." />
      )}

      <section className="card my-2">
        <h2 className="card-title">Code d&apos;accès</h2>
        <p className="mb-2 text-xs text-muted">
          Code à 8 caractères transmis par le régulateur (usage unique,
          valable 24 h). Votre session reste ensuite ouverte sur cet appareil.
        </p>
        <form action={loginWithCode} className="flex flex-col gap-2">
          <label className="field-label" htmlFor="code">
            Code d&apos;accès
          </label>
          <input
            className="input-base font-mono text-xl tracking-[0.3em]"
            id="code"
            name="code"
            type="text"
            inputMode="text"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            placeholder="XXXX-XXXX"
            maxLength={9}
            autoFocus
            required
          />
          <button className="btn-primary min-h-14 text-base" type="submit">
            Se connecter
          </button>
        </form>
      </section>

      <p className="px-1 pt-2 text-xs text-muted">
        Pas de code ? Contactez le régulateur, qui peut en générer un et vous le
        transmettre oralement. Plateforme réservée aux professionnels
        autorisés — aucune donnée nominative patient ne doit y être saisie.
      </p>
    </main>
  );
}

function Alert({ msg }: { msg: string }) {
  return (
    <div className="card my-2 border-centre">
      <p className="text-[15px] text-centre">{msg}</p>
    </div>
  );
}
