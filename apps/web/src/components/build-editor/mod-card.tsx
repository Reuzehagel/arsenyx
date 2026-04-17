import { cn } from "@/lib/utils";
import { getImageUrl } from "@/lib/warframe";
import type { Mod } from "@arsenyx/shared/warframe/types";

import { PolarityIcon } from "./polarity-icon";

type Rarity =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Legendary"
  | "Amalgam"
  | "Galvanized"
  | undefined;

const RARITY_BORDER: Record<string, string> = {
  Common: "border-zinc-500/70",
  Uncommon: "border-slate-300/70",
  Rare: "border-amber-400/80",
  Legendary: "border-fuchsia-400/80",
  Amalgam: "border-rose-500/80",
  Galvanized: "border-emerald-400/80",
};

const RARITY_TEXT: Record<string, string> = {
  Common: "text-zinc-200",
  Uncommon: "text-slate-100",
  Rare: "text-amber-200",
  Legendary: "text-fuchsia-200",
  Amalgam: "text-rose-200",
  Galvanized: "text-emerald-200",
};

function resolveRarity(mod: Mod): Rarity {
  const r = mod.rarity as Rarity;
  if (!r) return "Common";
  return r;
}

interface ModCardProps {
  mod: Mod;
  rank?: number;
  className?: string;
  onClick?: () => void;
}

/**
 * Compact visual mod card — rarity-framed tile with image, name, drain/polarity
 * badge, and rank dots. No drag, rank picker, or rivens yet; see Slice 6c/6d.
 */
export function ModCard({ mod, rank = 0, className, onClick }: ModCardProps) {
  const rarity = resolveRarity(mod) ?? "Common";
  const maxRank = mod.fusionLimit ?? 0;
  const drain = (mod.baseDrain ?? 0) + rank;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "relative flex aspect-[3/4] w-full flex-col overflow-hidden rounded-md border-2 bg-zinc-900/80 text-left shadow-sm transition-transform",
        RARITY_BORDER[rarity] ?? RARITY_BORDER.Common,
        onClick && "hover:scale-[1.02] hover:shadow-md focus-visible:ring-ring cursor-pointer focus-visible:ring-2 focus-visible:outline-none",
        !onClick && "cursor-default",
        className,
      )}
    >
      <img
        src={getImageUrl(mod.imageName)}
        alt=""
        loading="lazy"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-40"
        style={{ filter: "grayscale(0.6) brightness(0.55)" }}
      />

      <div className="relative z-10 flex items-start justify-between p-1.5">
        <div className="flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-semibold tabular-nums text-white">
          <span>{drain}</span>
          <PolarityIcon polarity={mod.polarity} className="size-3 opacity-80" />
        </div>
      </div>

      <span
        className={cn(
          "relative z-10 mt-auto line-clamp-2 px-1.5 pb-2 text-center text-[11px] leading-tight font-semibold drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]",
          RARITY_TEXT[rarity] ?? RARITY_TEXT.Common,
        )}
      >
        {mod.name}
      </span>

      {maxRank > 0 && (
        <div className="relative z-10 flex items-center justify-center gap-[2px] pb-1.5">
          {Array.from({ length: maxRank }).map((_, i) => (
            <span
              key={i}
              className={cn(
                "size-1 rounded-full",
                i < rank ? "bg-amber-400" : "bg-zinc-600/80",
              )}
            />
          ))}
        </div>
      )}
    </button>
  );
}
