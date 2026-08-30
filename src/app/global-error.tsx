"use client";

/**
 * Filet ultime (erreur dans le layout racine lui-même) : remplace tout le
 * document, donc styles inline uniquement — le CSS global n'est pas garanti.
 */

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100dvh",
          alignItems: "center",
          justifyContent: "center",
          padding: 16,
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: 420 }}>
          <h1 style={{ fontSize: 18, marginBottom: 8 }}>Erreur temporaire</h1>
          <p style={{ fontSize: 15, lineHeight: 1.5, marginBottom: 16 }}>
            L&apos;application n&apos;a pas pu se charger — incident passager.
            Rien n&apos;a été perdu : réessayez.
          </p>
          <button
            onClick={() => reset()}
            style={{
              width: "100%",
              padding: "12px 16px",
              fontSize: 16,
              borderRadius: 10,
              border: "none",
              background: "#b3261e",
              color: "#fff",
            }}
          >
            Réessayer
          </button>
          {error.digest && (
            <p style={{ fontSize: 11, color: "#777", marginTop: 12 }}>
              Référence technique : {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
