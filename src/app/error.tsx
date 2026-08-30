"use client";

/**
 * Écran d'erreur applicatif (D-016/D-018) : une exception serveur passagère OU
 * une fenêtre restée sur un ancien déploiement (PWA ouverte pendant un
 * redéploiement : chunks disparus, identifiants d'actions serveur périmés) ne
 * doit pas bloquer l'utilisateur. Le remède universel est un RECHARGEMENT
 * COMPLET (window.location.reload) : il récupère le HTML et le build à jour —
 * là où reset() ne ferait que rejouer la même requête périmée. Un rechargement
 * automatique est tenté une fois (garde anti-boucle de 60 s).
 */

import { useEffect } from "react";

const RELOAD_GUARD_KEY = "bf-auto-reload-at";

function fullReload() {
  try {
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {
    /* stockage indisponible : on recharge quand même */
  }
  window.location.reload();
}

export default function AppError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    let last = 0;
    try {
      last = Number(sessionStorage.getItem(RELOAD_GUARD_KEY) ?? 0);
    } catch {
      return; // sans garde fiable, pas de rechargement automatique
    }
    if (Date.now() - last > 60_000) fullReload();
  }, [error]);

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-lg font-semibold">Erreur temporaire</h1>
      <p className="text-[15px] leading-6">
        La page n&apos;a pas pu être chargée — incident passager ou application
        restée sur une ancienne version. Rien n&apos;a été perdu : recharger
        suffit dans la quasi-totalité des cas.
      </p>
      <button className="btn-primary w-full" onClick={fullReload}>
        Recharger l&apos;application
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
