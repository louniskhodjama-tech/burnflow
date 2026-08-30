import { redirect } from "next/navigation";
import { getActor, homeForRole } from "@/lib/auth";
import { loginWithCode, requestMagicLink } from "./actions";

export const metadata = { title: "Connexion — Triage brûlés" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; error?: string }>;
}) {
  const actor = await getActor();
  if (actor) redirect(homeForRole(actor.role));
  const { sent, error } = await searchParams;

  return (
    <main className="mx-auto max-w-md px-3 pb-16">
      <header className="px-1 pt-6 pb-2">
        <h1 className="text-sm font-semibold uppercase tracking-wider text-muted">
          Triage brûlés · connexion
        </h1>
      </header>

      {sent && (
        <div className="card my-2 border-chir bg-white">
          <p className="text-[15px]">
            Si un compte existe pour cette adresse, un lien de connexion vient
            d&apos;être envoyé. Il est valable <b>15 minutes</b>, à usage unique.
          </p>
        </div>
      )}
      {error === "email" && <Alert msg="Adresse email invalide." />}
      {error === "code" && (
        <Alert msg="Code invalide, expiré ou déjà utilisé. Vérifiez auprès du régulateur." />
      )}
      {error === "lien" && (
        <Alert msg="Lien invalide ou expiré. Demandez un nouveau lien." />
      )}
      {error === "limite" && (
        <Alert msg="Trop de tentatives. Réessayez dans quelques minutes." />
      )}

      <section className="card my-2">
        <h2 className="card-title">Par email</h2>
        <form action={requestMagicLink} className="flex flex-col gap-2">
          <label className="field-label" htmlFor="email">
            Adresse email professionnelle
          </label>
          <input
            className="input-base"
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="prenom.nom@sante.dz"
            required
          />
          <button className="btn-primary" type="submit">
            Recevoir le lien de connexion
          </button>
        </form>
      </section>

      <section className="card my-2">
        <h2 className="card-title">Par code d&apos;accès</h2>
        <p className="mb-2 text-xs text-muted">
          Code à 8 caractères transmis par le régulateur (usage unique, valable 24 h).
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
            required
          />
          <button className="btn-primary" type="submit">
            Se connecter
          </button>
        </form>
      </section>

      <p className="px-1 pt-2 text-xs text-muted">
        Plateforme réservée aux professionnels autorisés. Aucune donnée nominative
        patient ne doit y être saisie.
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
