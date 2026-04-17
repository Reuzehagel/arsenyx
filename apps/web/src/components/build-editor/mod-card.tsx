import { useState } from "react";

import { cn } from "@/lib/utils";
import {
  DISPLAY_SIZE,
  type ModRarity,
  getModAssetUrl,
  getRarityColor,
  normalizeRarity,
} from "@/lib/mod-card-config";
import { getImageUrl } from "@/lib/warframe";
import type { Mod } from "@arsenyx/shared/warframe/types";

import {
  DrainBadge,
  type DrainMatchState,
  LowerTab,
  ModCardFrame,
  RankCompleteLine,
  RankDots,
} from "./mod-card-frame";

const NUMBER_PATTERN = /(\d+(\.\d+)?)/g;

function getModStats(mod: Mod, rank: number, setCount: number = 0): string[] {
  if (!mod.levelStats || mod.levelStats.length === 0) return [];
  const levelIndex = Math.min(rank, mod.levelStats.length - 1);
  const baseStats = mod.levelStats[levelIndex]?.stats ?? [];

  if (
    mod.modSet === "/Lotus/Upgrades/Mods/Sets/Umbra/UmbraSetMod" &&
    setCount > 1
  ) {
    const isIntensify = mod.name.includes("Intensify");
    let multiplier = 1.0;
    if (setCount === 2) multiplier = isIntensify ? 1.25 : 1.3;
    else if (setCount >= 3) multiplier = isIntensify ? 1.75 : 1.8;
    return baseStats.map((stat) =>
      stat.replace(NUMBER_PATTERN, (match) => {
        const value = parseFloat(match);
        return parseFloat((value * multiplier).toFixed(1)).toString();
      }),
    );
  }

  return baseStats;
}

interface CompactProps {
  mod: Mod;
  rarity: ModRarity;
  rank: number;
  isMaxRank: boolean;
  drainOverride?: number;
  matchState?: DrainMatchState;
}

function CompactModCard({
  mod,
  rarity,
  rank,
  isMaxRank,
  drainOverride,
  matchState = "neutral",
}: CompactProps) {
  const maxRank = mod.fusionLimit ?? 0;
  const drain = drainOverride ?? (mod.baseDrain ?? 0) + rank;

  return (
    <ModCardFrame rarity={rarity} variant="compact">
      <DrainBadge
        drain={drain}
        polarity={mod.polarity}
        rarity={rarity}
        matchState={matchState}
      />

      <div
        className="pointer-events-none absolute top-[4px] right-[3px] -bottom-4 left-[3px] z-10 overflow-hidden rounded-b-[5px]"
      >
        <img
          src={getImageUrl(mod.imageName)}
          alt=""
          className="h-full w-full object-cover object-top"
          style={{ filter: "grayscale(0.7) brightness(0.35)" }}
        />
        <div
          className="pointer-events-none absolute inset-0 opacity-15"
          style={{
            backgroundColor: getRarityColor(rarity),
            mixBlendMode: "hard-light",
          }}
        />
      </div>

      <span
        className="absolute top-[70%] left-1/2 z-30 line-clamp-2 w-[170px] -translate-x-1/2 -translate-y-1/2 text-center text-[16px] leading-tight font-normal"
        style={{
          fontFamily: "Roboto, sans-serif",
          color: getRarityColor(rarity),
          textShadow:
            "-1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 1px 1px 0 #000, 0 0 6px #000, 0 0 12px #000",
        }}
      >
        {mod.name}
      </span>

      {isMaxRank && (
        <RankCompleteLine
          rarity={rarity}
          className="absolute -bottom-[28px] left-1/2 z-25 w-[calc(100%-8px)] -translate-x-1/2"
        />
      )}

      <RankDots rank={rank} maxRank={maxRank} variant="compact" />
    </ModCardFrame>
  );
}

interface ExpandedProps extends CompactProps {
  setCount?: number;
}

function ExpandedModCard({
  mod,
  rarity,
  rank,
  isMaxRank,
  setCount = 0,
  drainOverride,
  matchState = "neutral",
}: ExpandedProps) {
  const stats = getModStats(mod, rank, setCount);
  const maxRank = mod.fusionLimit ?? 0;
  const drain = drainOverride ?? (mod.baseDrain ?? 0) + rank;
  const compatLabel =
    mod.compatName ||
    (mod.type ? mod.type.replace(" Mod", "").toUpperCase() : "");

  const formattedStats = stats
    .map((s) => s.replace(/\\n/g, "<br/>"))
    .join("<br/>");

  return (
    <ModCardFrame rarity={rarity} variant="expanded">
      <DrainBadge
        drain={drain}
        polarity={mod.polarity}
        rarity={rarity}
        matchState={matchState}
      />

      <div className="absolute top-[4px] right-[3px] bottom-[4px] left-[3px] z-10 overflow-hidden">
        <img
          src={getImageUrl(mod.imageName)}
          alt=""
          className="h-full w-full object-contain object-top"
        />
      </div>

      <div className="absolute right-[3px] bottom-[20px] left-[3px] z-[15]">
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <img
            src={getModAssetUrl(rarity, "Background")}
            alt=""
            className="h-full w-full object-cover object-bottom"
          />
        </div>
        <div className="relative z-20 flex flex-col items-center px-2 pt-1.5 pb-2">
          <span
            className="text-center text-[14px] leading-tight font-medium"
            style={{
              fontFamily: "Roboto, sans-serif",
              color: getRarityColor(rarity),
            }}
          >
            {mod.name}
          </span>

          {formattedStats && (
            <div className="mt-1 flex w-full flex-col items-center gap-1 px-1">
              <span
                className="text-center text-[12px] leading-snug font-normal text-gray-300"
                style={{ fontFamily: "Roboto, sans-serif" }}
                dangerouslySetInnerHTML={{ __html: formattedStats }}
              />
            </div>
          )}

          <LowerTab label={compatLabel} rarity={rarity} className="mt-1" />
        </div>
      </div>

      {isMaxRank && (
        <RankCompleteLine
          rarity={rarity}
          className="absolute bottom-[4px] left-1/2 z-25 w-[calc(100%-8px)] -translate-x-1/2"
        />
      )}

      <RankDots rank={rank} maxRank={maxRank} variant="expanded" />
    </ModCardFrame>
  );
}

export interface ModCardProps {
  mod: Mod;
  rank?: number;
  setCount?: number;
  drainOverride?: number;
  matchState?: DrainMatchState;
  /** When true, always show the expanded variant (no hover behavior). */
  alwaysExpanded?: boolean;
  /** When true, never show the expanded variant (used while dragging). */
  disableHover?: boolean;
  onClick?: () => void;
  isSelected?: boolean;
  className?: string;
}

/**
 * In-game-styled mod card. Compact by default; expands on hover to show the
 * stats panel. No portal — the expanded variant floats over the compact one
 * in an absolute wrapper. Screenshot-perfect rendering lives in a separate
 * component (to be built with the screenshot service, Slice 8).
 */
export function ModCard({
  mod,
  rank = 0,
  setCount = 0,
  drainOverride,
  matchState,
  alwaysExpanded = false,
  disableHover = false,
  onClick,
  isSelected,
  className,
}: ModCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const rarity = normalizeRarity(mod.rarity);
  const maxRank = mod.fusionLimit ?? 0;
  const isMaxRank = maxRank > 0 && rank >= maxRank;
  const showExpanded = alwaysExpanded || (isHovered && !disableHover);

  const size = showExpanded ? DISPLAY_SIZE.expanded : DISPLAY_SIZE.compact;

  // Rank dots hang ~32px below the 64px compact frame; extend the hover
  // surface so cursor motion across the dots doesn't trigger mouseleave.
  const HOVER_OVERHANG = 32;

  return (
    <div
      className={cn(
        "relative",
        onClick && "cursor-pointer",
        isSelected && "brightness-125",
        className,
      )}
      style={{
        width: DISPLAY_SIZE.compact.width,
        height: DISPLAY_SIZE.compact.height + HOVER_OVERHANG,
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={onClick}
    >
      {/* When expanded, the expanded card floats centered above the compact footprint. */}
      <div
        className={cn(
          "absolute left-1/2 -translate-x-1/2 transition-opacity",
          showExpanded
            ? "-top-[calc(50%+(var(--expanded-h,285px)-var(--compact-h,64px))/2)] pointer-events-none z-50"
            : "top-0",
        )}
        style={
          showExpanded
            ? ({
                "--expanded-h": `${DISPLAY_SIZE.expanded.height}px`,
                "--compact-h": `${DISPLAY_SIZE.compact.height}px`,
                width: size.width,
                height: size.height,
                filter: "drop-shadow(0 0 20px rgba(0,0,0,0.8))",
              } as React.CSSProperties)
            : { width: size.width, height: size.height }
        }
      >
        {showExpanded ? (
          <ExpandedModCard
            mod={mod}
            rarity={rarity}
            rank={rank}
            isMaxRank={isMaxRank}
            setCount={setCount}
            drainOverride={drainOverride}
            matchState={matchState}
          />
        ) : (
          <CompactModCard
            mod={mod}
            rarity={rarity}
            rank={rank}
            isMaxRank={isMaxRank}
            drainOverride={drainOverride}
            matchState={matchState}
          />
        )}
      </div>
    </div>
  );
}
