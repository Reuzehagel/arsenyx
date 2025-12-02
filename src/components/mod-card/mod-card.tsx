"use client";

import Image from "next/image";
import { getImageUrl } from "@/lib/warframe/images";
import { cn } from "@/lib/utils";
import { PolarityIcon } from "@/components/icons";
import type { Mod } from "@/lib/warframe/types";

// =============================================================================
// RARITY STYLES
// =============================================================================

type ModRarity = "Common" | "Uncommon" | "Rare" | "Legendary" | "Peculiar";

// Background gradients matching Warframe's mod card colors
const RARITY_BACKGROUNDS: Record<ModRarity, string> = {
  Common: "from-amber-900/80 via-amber-950/60 to-stone-950/80",
  Uncommon: "from-slate-400/30 via-slate-600/40 to-slate-900/60",
  Rare: "from-yellow-500/40 via-yellow-700/30 to-amber-950/60",
  Legendary: "from-white/20 via-slate-300/15 to-slate-800/40",
  Peculiar: "from-purple-500/40 via-purple-800/30 to-slate-950/60",
};

// Border/frame colors
const RARITY_BORDERS: Record<ModRarity, string> = {
  Common: "border-amber-700/60",
  Uncommon: "border-slate-400/50",
  Rare: "border-yellow-500/60",
  Legendary: "border-white/40",
  Peculiar: "border-purple-500/60",
};

// Accent glow colors for active/hover states
const RARITY_GLOWS: Record<ModRarity, string> = {
  Common: "shadow-amber-700/30",
  Uncommon: "shadow-slate-400/30",
  Rare: "shadow-yellow-500/40",
  Legendary: "shadow-white/30",
  Peculiar: "shadow-purple-500/40",
};

// Top border accent (the distinctive colored bar at the top)
const RARITY_TOP_ACCENT: Record<ModRarity, string> = {
  Common: "from-amber-600 via-amber-700 to-amber-800",
  Uncommon: "from-slate-300 via-slate-400 to-slate-500",
  Rare: "from-yellow-400 via-yellow-500 to-yellow-600",
  Legendary: "from-white via-slate-200 to-slate-300",
  Peculiar: "from-purple-400 via-purple-500 to-purple-600",
};

// =============================================================================
// MOD CARD COMPONENT
// =============================================================================

export type ModCardSize = "compact" | "large";

export interface ModCardProps {
  mod: Mod;
  size?: ModCardSize;
  rank?: number; // Current rank (0 to fusionLimit)
  isSelected?: boolean;
  isDisabled?: boolean;
  showStats?: boolean;
  onClick?: () => void;
  className?: string;
}

export function ModCard({
  mod,
  size = "compact",
  rank,
  isSelected = false,
  isDisabled = false,
  showStats = true,
  onClick,
  className,
}: ModCardProps) {
  const rarity = (mod.rarity as ModRarity) ?? "Common";
  const currentRank = rank ?? mod.fusionLimit;
  const maxRank = mod.fusionLimit;

  if (size === "large") {
    return (
      <LargeModCard
        mod={mod}
        rarity={rarity}
        currentRank={currentRank}
        maxRank={maxRank}
        isSelected={isSelected}
        isDisabled={isDisabled}
        showStats={showStats}
        onClick={onClick}
        className={className}
      />
    );
  }

  return (
    <CompactModCard
      mod={mod}
      rarity={rarity}
      currentRank={currentRank}
      maxRank={maxRank}
      isSelected={isSelected}
      isDisabled={isDisabled}
      onClick={onClick}
      className={className}
    />
  );
}

// =============================================================================
// COMPACT MOD CARD (Horizontal bar style, like in-game)
// =============================================================================

interface InternalModCardProps {
  mod: Mod;
  rarity: ModRarity;
  currentRank: number;
  maxRank: number;
  isSelected: boolean;
  isDisabled: boolean;
  showStats?: boolean;
  onClick?: () => void;
  className?: string;
}

// Frame colors for compact card
const COMPACT_FRAME_COLORS: Record<ModRarity, { border: string; corner: string; glow: string }> = {
  Common: { 
    border: "border-amber-800/70", 
    corner: "bg-amber-600",
    glow: "shadow-amber-600/20"
  },
  Uncommon: { 
    border: "border-slate-500/70", 
    corner: "bg-slate-400",
    glow: "shadow-slate-400/20"
  },
  Rare: { 
    border: "border-yellow-600/70", 
    corner: "bg-yellow-500",
    glow: "shadow-yellow-500/30"
  },
  Legendary: { 
    border: "border-slate-300/70", 
    corner: "bg-white",
    glow: "shadow-white/20"
  },
  Peculiar: { 
    border: "border-purple-600/70", 
    corner: "bg-purple-500",
    glow: "shadow-purple-500/20"
  },
};

function CompactModCard({
  mod,
  rarity,
  currentRank,
  maxRank,
  isSelected,
  isDisabled,
  onClick,
  className,
}: InternalModCardProps) {
  const frameColors = COMPACT_FRAME_COLORS[rarity];
  
  return (
    <div
      onClick={isDisabled ? undefined : onClick}
      className={cn(
        "relative w-[180px] h-[48px] transition-all group",
        onClick && !isDisabled && "cursor-pointer hover:scale-[1.02]",
        isSelected && "scale-[1.02]",
        isDisabled && "opacity-50 grayscale cursor-not-allowed",
        className
      )}
    >
      {/* Main container with frame */}
      <div className="relative w-full h-full">
        {/* Dark background */}
        <div className="absolute inset-0 bg-gradient-to-b from-slate-900 via-slate-950 to-black rounded-sm" />
        
        {/* Border frame */}
        <div className={cn(
          "absolute inset-0 border rounded-sm",
          frameColors.border,
          isSelected && "border-primary"
        )} />
        
        {/* Top frame line with corner accents */}
        <div className="absolute top-0 left-0 right-0 h-[2px]">
          {/* Left corner accent */}
          <div className={cn(
            "absolute left-0 top-0 w-3 h-[2px]",
            frameColors.corner
          )} />
          {/* Center thin line */}
          <div className="absolute left-3 right-12 top-0 h-[1px] bg-slate-600/50" />
          {/* Right corner (drain backer area) */}
          <div className={cn(
            "absolute right-0 top-0 w-12 h-[2px]",
            frameColors.corner
          )} />
        </div>
        
        {/* Bottom frame with corner accents */}
        <div className="absolute bottom-0 left-0 right-0 h-[2px]">
          {/* Left corner */}
          <div className={cn(
            "absolute left-0 bottom-0 w-4 h-[2px]",
            frameColors.corner
          )} />
          {/* Center line */}
          <div className="absolute left-4 right-4 bottom-0 h-[1px] bg-slate-600/50" />
          {/* Right corner */}
          <div className={cn(
            "absolute right-0 bottom-0 w-4 h-[2px]",
            frameColors.corner
          )} />
        </div>
        
        {/* Left side accent */}
        <div className={cn(
          "absolute left-0 top-0 bottom-0 w-[2px]",
          "bg-gradient-to-b from-transparent via-slate-600/30 to-transparent"
        )}>
          <div className={cn(
            "absolute top-0 left-0 w-[2px] h-3",
            frameColors.corner
          )} />
          <div className={cn(
            "absolute bottom-0 left-0 w-[2px] h-3",
            frameColors.corner
          )} />
        </div>
        
        {/* Right side accent */}
        <div className={cn(
          "absolute right-0 top-0 bottom-0 w-[2px]",
          "bg-gradient-to-b from-transparent via-slate-600/30 to-transparent"
        )}>
          <div className={cn(
            "absolute top-0 right-0 w-[2px] h-3",
            frameColors.corner
          )} />
          <div className={cn(
            "absolute bottom-0 right-0 w-[2px] h-3",
            frameColors.corner
          )} />
        </div>
        
        {/* Content area */}
        <div className="absolute inset-[3px] flex items-center">
          {/* Mod Image */}
          <div className="relative w-[42px] h-[42px] flex-shrink-0 overflow-hidden">
            <Image
              src={getImageUrl(mod.imageName)}
              alt={mod.name}
              fill
              className="object-contain"
            />
          </div>
          
          {/* Mod Name & Info */}
          <div className="flex-1 min-w-0 px-2 flex flex-col justify-center">
            <span className="font-medium text-[11px] text-white/90 truncate leading-tight">
              {mod.name}
            </span>
            {/* Rank Pips */}
            <div className="mt-1">
              <RankPips currentRank={currentRank} maxRank={maxRank} size="sm" />
            </div>
          </div>
          
          {/* Drain & Polarity (top right area) */}
          <div className="absolute top-0 right-0 flex items-center gap-1 px-1.5 py-0.5 bg-slate-900/80">
            {mod.polarity && mod.polarity !== "universal" && (
              <PolarityIcon polarity={mod.polarity} size="sm" />
            )}
            <span className="text-[10px] font-bold text-cyan-300">
              {mod.baseDrain}
            </span>
          </div>
        </div>
        
        {/* Selection glow */}
        {isSelected && (
          <div className={cn(
            "absolute inset-0 rounded-sm shadow-[inset_0_0_8px_rgba(59,130,246,0.5)]",
            "pointer-events-none"
          )} />
        )}
      </div>
    </div>
  );
}

// =============================================================================
// LARGE MOD CARD (Vertical, like in-game)
// =============================================================================

function LargeModCard({
  mod,
  rarity,
  currentRank,
  maxRank,
  isSelected,
  isDisabled,
  showStats,
  onClick,
  className,
}: InternalModCardProps) {
  // Parse the first stat from levelStats if available
  const currentStats = mod.levelStats?.[currentRank]?.stats ?? [];

  return (
    <div
      onClick={isDisabled ? undefined : onClick}
      className={cn(
        "relative flex flex-col rounded-lg transition-all group overflow-hidden",
        "border-2 bg-gradient-to-b",
        RARITY_BACKGROUNDS[rarity],
        RARITY_BORDERS[rarity],
        onClick && !isDisabled && "cursor-pointer hover:scale-[1.02]",
        isSelected && cn("ring-2 ring-primary shadow-xl", RARITY_GLOWS[rarity]),
        isDisabled && "opacity-50 grayscale cursor-not-allowed",
        "w-[128px]",
        className
      )}
    >
      {/* Top Accent Bar */}
      <div
        className={cn(
          "h-1.5 w-full bg-gradient-to-r",
          RARITY_TOP_ACCENT[rarity]
        )}
      />

      {/* Header: Polarity & Drain */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex items-center gap-1">
          {mod.polarity && mod.polarity !== "universal" && (
            <PolarityIcon polarity={mod.polarity} size="sm" />
          )}
        </div>
        <span className="text-xs font-bold text-white/90">{mod.baseDrain}</span>
      </div>

      {/* Mod Image */}
      <div className="relative w-full aspect-square bg-black/20 overflow-hidden">
        <Image
          src={getImageUrl(mod.imageName)}
          alt={mod.name}
          fill
          className="object-contain p-2"
        />
        {/* Corner lights effect */}
        <div className="absolute inset-0 pointer-events-none">
          <div
            className={cn(
              "absolute top-0 left-0 w-6 h-6 bg-gradient-to-br opacity-30",
              rarity === "Common" && "from-amber-500/50",
              rarity === "Uncommon" && "from-slate-300/50",
              rarity === "Rare" && "from-yellow-400/50",
              rarity === "Legendary" && "from-white/50",
              rarity === "Peculiar" && "from-purple-400/50"
            )}
          />
          <div
            className={cn(
              "absolute top-0 right-0 w-6 h-6 bg-gradient-to-bl opacity-30",
              rarity === "Common" && "from-amber-500/50",
              rarity === "Uncommon" && "from-slate-300/50",
              rarity === "Rare" && "from-yellow-400/50",
              rarity === "Legendary" && "from-white/50",
              rarity === "Peculiar" && "from-purple-400/50"
            )}
          />
        </div>
      </div>

      {/* Mod Name */}
      <div className="px-2 py-1.5 text-center">
        <span className="text-xs font-semibold text-white leading-tight line-clamp-2">
          {mod.name}
        </span>
      </div>

      {/* Stats (if enabled) */}
      {showStats && currentStats.length > 0 && (
        <div className="px-2 pb-1.5">
          <div className="text-[10px] text-white/70 text-center leading-tight line-clamp-2">
            {currentStats[0]}
          </div>
        </div>
      )}

      {/* Rank Pips */}
      <div className="px-2 pb-2">
        <RankPips currentRank={currentRank} maxRank={maxRank} size="md" />
      </div>

      {/* Bottom Accent */}
      <div
        className={cn(
          "h-0.5 w-full bg-gradient-to-r opacity-60",
          RARITY_TOP_ACCENT[rarity]
        )}
      />
    </div>
  );
}

// =============================================================================
// RANK PIPS COMPONENT
// =============================================================================

interface RankPipsProps {
  currentRank: number;
  maxRank: number;
  size?: "sm" | "md";
}

function RankPips({ currentRank, maxRank, size = "sm" }: RankPipsProps) {
  if (maxRank === 0) return null;

  const pipSize = size === "sm" ? "w-1.5 h-1.5" : "w-2 h-2";
  const gap = size === "sm" ? "gap-0.5" : "gap-1";

  return (
    <div className={cn("flex items-center justify-center", gap)}>
      {Array.from({ length: maxRank }).map((_, i) => (
        <div
          key={i}
          className={cn(
            pipSize,
            "rounded-full transition-colors",
            i < currentRank
              ? "bg-cyan-400 shadow-[0_0_4px_rgba(34,211,238,0.6)]"
              : "bg-white/20 border border-white/10"
          )}
        />
      ))}
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export { RankPips };
export type { ModRarity };
