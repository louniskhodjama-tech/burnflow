"use client";

/**
 * Carte corporelle face/dos — reprise du SVG et de l'interaction du prototype
 * validé (docs/triage-brulures-v3.html) : bulle par zone (fraction + profondeur
 * + circonférentielle), badges de % par zone, coloration par profondeur.
 */

import { useRef, useState } from "react";
import {
  DEPTHS,
  FRACTIONS,
  REGIONS,
  regionPct,
  type Depth,
  type RegionsInput,
} from "@/lib/burn-scoring";

const DCOL: Record<Depth, string> = {
  "1": "#F6C9BE",
  "2s": "#E48A72",
  "2p": "#B23A48",
  "3": "#3B1F2B",
};

type Shape = { id: string; x: number; y: number; w: number; h: number; rx: number };
const rr = (id: string, x: number, y: number, w: number, h: number, rx: number): Shape => ({
  id, x, y, w, h, rx,
});

// Vue face à x=0 (patient droit = gauche de l'écran), vue dos à x=220.
const FRONT: Shape[] = [
  rr("neck", 90, 66, 24, 18, 6), rr("tant", 60, 84, 84, 116, 18), rr("genit", 90, 200, 24, 14, 6),
  rr("rua", 26, 88, 30, 62, 12), rr("rfa", 24, 152, 28, 58, 10), rr("rh", 20, 212, 30, 34, 12),
  rr("lua", 148, 88, 30, 62, 12), rr("lfa", 152, 152, 28, 58, 10), rr("lh", 154, 212, 30, 34, 12),
  rr("rth", 62, 214, 38, 92, 14), rr("rlg", 63, 308, 34, 80, 12), rr("rft", 56, 390, 40, 26, 10),
  rr("lth", 104, 214, 38, 92, 14), rr("llg", 107, 308, 34, 80, 12), rr("lft", 108, 390, 40, 26, 10),
];
const BACK: Shape[] = [
  rr("neck", 310, 66, 24, 18, 6), rr("tpost", 280, 84, 84, 104, 18), rr("butt", 280, 188, 84, 26, 10),
  rr("lua", 246, 88, 30, 62, 12), rr("lfa", 244, 152, 28, 58, 10), rr("lh", 240, 212, 30, 34, 12),
  rr("rua", 368, 88, 30, 62, 12), rr("rfa", 372, 152, 28, 58, 10), rr("rh", 374, 212, 30, 34, 12),
  rr("lth", 282, 214, 38, 92, 14), rr("llg", 283, 308, 34, 80, 12), rr("lft", 276, 390, 40, 26, 10),
  rr("rth", 324, 214, 38, 92, 14), rr("rlg", 327, 308, 34, 80, 12), rr("rft", 328, 390, 40, 26, 10),
];
const HEADS: [string, number, number][] = [
  ["head", 102, 36],
  ["head", 322, 36],
];

export const emptyRegions = (): RegionsInput => {
  const out: RegionsInput = {};
  for (const k of Object.keys(REGIONS)) out[k] = { frac: 0, depth: null, circ: false };
  return out;
};

type BubbleState = {
  regionKey: string;
  left: number;
  top: number;
  below: boolean;
  arrowX: number;
} | null;

export function BodyMap({
  regions,
  onChange,
  age,
}: {
  regions: RegionsInput;
  onChange: (next: RegionsInput) => void;
  age: number | null;
}) {
  const mapRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [bubble, setBubble] = useState<BubbleState>(null);

  const current = bubble ? regions[bubble.regionKey] : undefined;
  const currentDef = bubble ? REGIONS[bubble.regionKey] : undefined;

  function openBubble(el: SVGElement, regionKey: string) {
    const map = mapRef.current;
    if (!map) return;
    const mr = map.getBoundingClientRect();
    const er = el.getBoundingClientRect();
    // Dimensions estimées avant rendu (la bulle fait ~min(300, largeur-16) × ~230)
    const bw = Math.min(300, mr.width - 16);
    const bh = bubbleRef.current?.offsetHeight ?? 240;
    let left = er.left - mr.left + er.width / 2 - bw / 2;
    left = Math.max(8, Math.min(left, mr.width - bw - 8));
    let top = er.bottom - mr.top + 10;
    let below = false;
    if (top + bh > mr.height - 4) {
      top = er.top - mr.top - bh - 10;
      below = true;
      if (top < 0) top = 8;
    }
    const arrowX = er.left - mr.left + er.width / 2 - left;
    setBubble({ regionKey, left, top, below, arrowX });
  }

  function update(regionKey: string, patch: Partial<{ frac: number; depth: Depth | null; circ: boolean }>) {
    const prev = regions[regionKey] ?? { frac: 0, depth: null, circ: false };
    const next = { ...prev, ...patch };
    if (next.frac === 0) {
      next.depth = null;
      next.circ = false;
    }
    onChange({ ...regions, [regionKey]: next });
    return next;
  }

  function pickFrac(v: number) {
    if (!bubble) return;
    const next = update(bubble.regionKey, { frac: v });
    if (v === 0 || (next.frac > 0 && next.depth)) setBubble(null);
  }
  function pickDepth(v: Depth) {
    if (!bubble) return;
    const next = update(bubble.regionKey, { depth: v });
    if (next.frac > 0 && next.depth) setBubble(null);
  }

  const badge = (id: string) => {
    const s = regions[id];
    if (!s || s.frac <= 0) return "";
    if (!s.depth || s.depth === "1") return s.frac > 0 ? "1er" : "";
    const p = regionPct(id, age);
    return `${Math.round(p * s.frac * 10) / 10}%`;
  };

  const fillFor = (id: string) => {
    const s = regions[id];
    if (s && s.frac > 0 && s.depth)
      return { fill: DCOL[s.depth], fillOpacity: +(0.4 + 0.6 * s.frac).toFixed(2) };
    return { fill: "var(--color-skin)", fillOpacity: 1 };
  };

  const shapeProps = (id: string) => ({
    className: "cursor-pointer transition-[fill]",
    stroke: bubble?.regionKey === id ? "var(--color-ink)" : "#fff",
    strokeWidth: bubble?.regionKey === id ? 2.5 : 1.5,
    tabIndex: 0,
    role: "button" as const,
    "aria-label": REGIONS[id]?.name ?? id,
    ...fillFor(id),
  });

  return (
    <div className="relative" ref={mapRef}>
      <div className="flex justify-between px-2 pb-1 text-xs uppercase tracking-wider text-muted">
        <span>Face</span>
        <span>Dos</span>
      </div>
      <svg
        viewBox="0 0 440 430"
        className="block h-auto w-full touch-manipulation select-none"
        aria-label="Carte corporelle, face et dos"
      >
        {HEADS.map(([id, cx, cy], i) => (
          <ellipse
            key={`h${i}`}
            cx={cx}
            cy={cy}
            rx={26}
            ry={30}
            {...shapeProps(id)}
            onClick={(e) => openBubble(e.currentTarget, id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openBubble(e.currentTarget, id);
              }
            }}
          />
        ))}
        {[...FRONT, ...BACK].map((s, i) => (
          <rect
            key={`r${i}`}
            x={s.x}
            y={s.y}
            width={s.w}
            height={s.h}
            rx={s.rx}
            {...shapeProps(s.id)}
            onClick={(e) => openBubble(e.currentTarget, s.id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                openBubble(e.currentTarget, s.id);
              }
            }}
          />
        ))}
        {HEADS.map(([id, cx, cy], i) => (
          <text key={`hb${i}`} x={cx} y={cy + 4} className="pointer-events-none" textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff" stroke="rgba(0,0,0,.35)" strokeWidth={2} paintOrder="stroke">
            {badge(id)}
          </text>
        ))}
        {[...FRONT, ...BACK].map((s, i) => (
          <text key={`rb${i}`} x={s.x + s.w / 2} y={s.y + s.h / 2 + 3} className="pointer-events-none" textAnchor="middle" fontSize={9} fontWeight={700} fill="#fff" stroke="rgba(0,0,0,.35)" strokeWidth={2} paintOrder="stroke">
            {badge(s.id)}
          </text>
        ))}
      </svg>

      {bubble && currentDef && current && (
        <div
          ref={bubbleRef}
          role="dialog"
          className="absolute z-10 rounded-2xl bg-ink p-3 text-white shadow-2xl"
          style={{ left: bubble.left, top: bubble.top, width: `min(300px, calc(100% - 16px))` }}
        >
          <div
            className="absolute h-3.5 w-3.5 rotate-45 bg-ink"
            style={
              bubble.below
                ? { bottom: -7, left: bubble.arrowX - 7 }
                : { top: -7, left: bubble.arrowX - 7 }
            }
          />
          <div className="mb-2 flex items-baseline justify-between">
            <b className="text-base">{currentDef.name}</b>
            <span className="text-xs text-[#B8C4CE]">
              {regionPct(bubble.regionKey, age)} % de la surface corporelle
            </span>
          </div>
          <small className="mb-1 block text-[11px] uppercase tracking-wider text-[#B8C4CE]">
            1 · Fraction atteinte
          </small>
          <div className="flex gap-1">
            {FRACTIONS.map((f) => (
              <button
                key={f.v}
                type="button"
                aria-pressed={current.frac === f.v}
                onClick={() => pickFrac(f.v)}
                className={`min-h-[42px] flex-1 rounded-lg border text-sm ${
                  current.frac === f.v
                    ? "border-white bg-white font-semibold text-ink"
                    : "border-white/25 bg-white/10 text-white"
                }`}
              >
                {f.l}
              </button>
            ))}
          </div>
          <small className="mt-2 mb-1 block text-[11px] uppercase tracking-wider text-[#B8C4CE]">
            2 · Profondeur dominante — la bulle se ferme quand les deux sont choisis
          </small>
          <div className="flex gap-1">
            {DEPTHS.map((d) => (
              <button
                key={d.v}
                type="button"
                aria-pressed={current.depth === d.v}
                onClick={() => pickDepth(d.v as Depth)}
                className={`relative min-h-[42px] flex-1 rounded-lg border pl-4 text-xs ${
                  current.depth === d.v
                    ? "border-white bg-white font-semibold text-ink"
                    : "border-white/25 bg-white/10 text-white"
                }`}
              >
                <span
                  className="absolute left-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-sm"
                  style={{ background: DCOL[d.v as Depth] }}
                />
                {d.l}
              </button>
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[13px]">
            <label
              className="flex min-h-0 items-center gap-1.5"
              style={{ visibility: currentDef.circ ? "visible" : "hidden" }}
            >
              <input
                type="checkbox"
                className="h-4.5 w-4.5 min-h-0"
                checked={current.circ}
                onChange={(e) => update(bubble.regionKey, { circ: e.target.checked })}
              />
              Circonférentielle
            </label>
            <button
              type="button"
              className="min-h-0 text-[13px] text-[#B8C4CE] underline"
              onClick={() => setBubble(null)}
            >
              Fermer
            </button>
          </div>
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-2.5 text-xs text-muted">
        <LegendItem color={DCOL["1"]} label="1er (exclu SCB)" />
        <LegendItem color={DCOL["2s"]} label="2e superficiel" />
        <LegendItem color={DCOL["2p"]} label="2e profond" />
        <LegendItem color={DCOL["3"]} label="3e" />
      </div>
    </div>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-block h-3 w-3 rounded-[3px] border border-black/10"
        style={{ background: color }}
      />
      {label}
    </span>
  );
}
