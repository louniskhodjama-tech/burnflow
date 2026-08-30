"use client";

/**
 * Écran d'erreur applicatif (D-016) : une exception serveur passagère
 * (réseau, base injoignable un instant) ne doit pas afficher la page
 * technique anglaise de Next — l'utilisateur en situation de crise doit
 * pouvoir réessayer d'un geste. Aucune donnée n'est perdue : les écritures
 * sont transactionnelles côté serveur.
 */

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-lg font-semibold">Erreur temporaire</h1>
      <p className="text-[15px] leading-6">
        La page n&apos;a pas pu être chargée — incident réseau ou serveur
        passager. Rien n&apos;a été perdu : réessayez, puis reprenez votre
        action.
      </p>
      <button className="btn-primary w-full" onClick={() => reset()}>
        Réessayer
      </button>
      <a className="text-[14px] underline" href="/">
        Revenir à l&apos;accueil
      </a>
      {error.digest && (
        <p className="text-[11px] text-muted">
          Référence technique : {error.digest}
        </p>
      )}
    </main>
  );
}
