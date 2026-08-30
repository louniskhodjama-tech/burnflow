"use client";

import { useEffect, useState } from "react";

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

async function subscribe(vapidKey: string): Promise<boolean> {
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const sub =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
    }));
  const json = sub.toJSON();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ endpoint: sub.endpoint, keys: json.keys }),
  });
  return res.ok;
}

/**
 * Bandeau d'activation des notifications push.
 * - support absent ou clé VAPID absente → rien ;
 * - permission déjà accordée → (ré)abonnement silencieux ;
 * - sinon → bandeau avec bouton (la demande de permission doit venir d'un geste).
 */
export function PushManager({ vapidKey }: { vapidKey: string | null }) {
  const [state, setState] = useState<"hidden" | "prompt" | "error">("hidden");

  useEffect(() => {
    if (!vapidKey) return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "granted") {
      void subscribe(vapidKey).catch(() => {});
    } else if (Notification.permission === "default") {
      const dismissed = localStorage.getItem("push-dismissed");
      if (!dismissed) setState("prompt");
    }
  }, [vapidKey]);

  if (state === "hidden" || !vapidKey) return null;

  return (
    <div className="mx-auto max-w-2xl px-3 pt-2">
      <div className="card flex items-center justify-between gap-2 border-accent">
        <p className="text-[13px]">
          Activez les notifications pour être alerté des demandes et réponses,
          même écran éteint.
        </p>
        <div className="flex shrink-0 gap-1">
          <button
            className="btn-primary min-h-10 px-3 text-[13px]"
            onClick={async () => {
              try {
                const perm = await Notification.requestPermission();
                if (perm === "granted" && (await subscribe(vapidKey))) {
                  setState("hidden");
                } else {
                  setState("error");
                }
              } catch {
                setState("error");
              }
            }}
          >
            Activer
          </button>
          <button
            className="btn-base min-h-10 px-2 text-[13px]"
            onClick={() => {
              localStorage.setItem("push-dismissed", "1");
              setState("hidden");
            }}
          >
            Plus tard
          </button>
        </div>
      </div>
      {state === "error" && (
        <p className="px-1 pt-1 text-xs text-centre">
          Notifications refusées ou indisponibles sur cet appareil.
        </p>
      )}
    </div>
  );
}
