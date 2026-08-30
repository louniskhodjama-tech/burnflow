const STYLES: Record<1 | 2 | 3, { bg: string; label: string }> = {
  1: { bg: "bg-chir", label: "1 · Chirurgie" },
  2: { bg: "bg-rea", label: "2 · Réanimation" },
  3: { bg: "bg-centre", label: "3 · Centre des brûlés" },
};

export function ClassChip({
  klass,
  small,
  labelOverride,
}: {
  klass: 1 | 2 | 3;
  small?: boolean;
  labelOverride?: string;
}) {
  const s = STYLES[klass];
  return (
    <span
      className={`inline-block rounded-lg font-bold text-white ${s.bg} ${
        small ? "px-2 py-1 text-xs" : "px-3 py-2 text-[15px]"
      }`}
    >
      {labelOverride ?? s.label}
    </span>
  );
}
