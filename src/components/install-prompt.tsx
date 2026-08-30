"use client";

import { useEffect, useState } from "react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as { standalone?: boolean }).standalone === true
  );
}

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes("Mac") && "ontouchend" in document);
}

/**
 * Bandeau « Installer l'application » :
 * - Chrome/Edge (desktop + Android) : via beforeinstallprompt ;
 * - iOS Safari : petites instructions (pas d'API d'installation) ;
 * - masqué si déjà installée (mode standalone) ou refusé (mémorisé).
 */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [mode, setMode] = useState<"hidden" | "chromium" | "ios">("hidden");

  useEffect(() => {
    try {
      if (isStandalone()) return;
      if (localStorage.getItem("install-dismissed")) return;

      const onPrompt = (e: Event) => {
        e.preventDefault();
        setDeferred(e as BeforeInstallPromptEvent);
        setMode("chromium");
      };
      window.addEventListener("beforeinstallprompt", onPrompt);
      const onInstalled = () => setMode("hidden");
      window.addEventListener("appinstalled", onInstalled);

      if (isIos()) setMode("ios");

      return () => {
        window.removeEventListener("beforeinstallprompt", onPrompt);
        window.removeEventListener("appinstalled", onInstalled);
      };
    } catch {
      // stockage bloqué : pas de bandeau
    }
  }, []);

  if (mode === "hidden") return null;

  const dismiss = () => {
    try {
      localStorage.setItem("install-dismissed", "1");
    } catch {}
    setMode("hidden");
  };

  return (
    <div className="mx-auto max-w-2xl px-3 pt-2">
      <div className="card flex items-center justify-between gap-2 border-ink">
        {mode === "chromium" ? (
          <>
            <p className="text-[13px]">
              Installez l&apos;application sur cet appareil : lancement direct,
              plein écran, notifications.
            </p>
            <div className="flex shrink-0 gap-1">
              <button
                className="btn-primary min-h-10 px-3 text-[13px]"
                onClick={async () => {
                  if (!deferred) return;
                  await deferred.prompt();
                  const choice = await deferred.userChoice;
                  if (choice.outcome === "accepted") setMode("hidden");
                  setDeferred(null);
                }}
              >
                Installer
              </button>
              <button className="btn-base min-h-10 px-2 text-[13px]" onClick={dismiss}>
                Plus tard
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="text-[13px]">
              Pour installer sur iPhone/iPad : bouton <b>Partager</b> puis
              «&nbsp;<b>Sur l&apos;écran d&apos;accueil</b>&nbsp;».
            </p>
            <button className="btn-base min-h-10 shrink-0 px-2 text-[13px]" onClick={dismiss}>
              OK
            </button>
          </>
        )}
      </div>
    </div>
  );
}
