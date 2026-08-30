"use client";

import { useEffect, useState } from "react";

/** Compte à rebours mm:ss jusqu'à une échéance ISO. Affiche « expiré » ensuite. */
export function Countdown({ deadline }: { deadline: string }) {
  const [left, setLeft] = useState(() => new Date(deadline).getTime() - Date.now());

  useEffect(() => {
    const t = setInterval(
      () => setLeft(new Date(deadline).getTime() - Date.now()),
      1000,
    );
    return () => clearInterval(t);
  }, [deadline]);

  if (left <= 0)
    return <span className="font-bold text-centre">expiré — bascule imminente</span>;

  const m = Math.floor(left / 60000);
  const s = Math.floor((left % 60000) / 1000);
  return (
    <span className={`font-bold tabular-nums ${left < 120_000 ? "text-centre" : ""}`}>
      {m}:{s.toString().padStart(2, "0")}
    </span>
  );
}
