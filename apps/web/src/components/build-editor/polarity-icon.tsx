import type { Polarity } from "@arsenyx/shared/warframe/types";

import { cn } from "@/lib/utils";

interface PolarityIconProps {
  polarity?: Polarity;
  className?: string;
}

/**
 * Minimal polarity glyph. Legacy uses dedicated SVGs per polarity; here we
 * use short text labels with polarity-colored backgrounds. Swap for SVGs once
 * we port the asset set.
 */
export function PolarityIcon({
  polarity = "universal",
  className,
}: PolarityIconProps) {
  const p = polarity ?? "universal";
  if (p === "universal" || p === "any") return null;

  const LABEL: Record<string, string> = {
    madurai: "V",
    vazarin: "D",
    naramon: "—",
    zenurik: "Z",
    unairu: "U",
    penjaga: "P",
    umbra: "Ω",
  };

  const COLOR: Record<string, string> = {
    madurai: "bg-rose-500/90",
    vazarin: "bg-sky-500/90",
    naramon: "bg-zinc-400/90",
    zenurik: "bg-amber-400/90",
    unairu: "bg-amber-700/90",
    penjaga: "bg-emerald-500/90",
    umbra: "bg-violet-500/90",
  };

  return (
    <span
      aria-label={`${p} polarity`}
      className={cn(
        "inline-flex items-center justify-center rounded-sm text-[8px] font-bold text-black",
        COLOR[p] ?? "bg-zinc-500",
        className,
      )}
    >
      {LABEL[p] ?? "?"}
    </span>
  );
}
