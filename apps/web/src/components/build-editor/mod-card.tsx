import { useEffect, useState } from "react";

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
  /** Leave undefined to default to the mod's max rank. */
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
// Rank dots hang ~32px below the 64px compact frame; extend the hover surface
// so cursor motion across the dots doesn't trigger mouseleave.
const HOVER_OVERHANG = 32;
// Center the expanded card around the compact visual (y=32 inside the
// HOVER_OVERHANG-extended wrapper, which makes transform-origin: center
// scale naturally from the compact card's own midpoint).
const COMPACT_CENTER_Y = DISPLAY_SIZE.compact.height / 2;

export function ModCard({
  mod,
  rank,
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
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<"closed" | "open">("closed");
  const rarity = normalizeRarity(mod.rarity);
  const maxRank = mod.fusionLimit ?? 0;
  // Default to max rank so preview cards read the way equipped mods look
  // in-game. Callers that need a specific rank (placed slots) pass one.
  const effectiveRank = rank ?? maxRank;
  const isMaxRank = maxRank > 0 && effectiveRank >= maxRank;
  const wantsExpanded = alwaysExpanded || (isHovered && !disableHover);

  // Animation state machine. wantsExpanded drives two things:
  //   - mount/unmount the expanded subtree (kept during close transition)
  //   - flip the data-state so CSS transitions fire between renders
  useEffect(() => {
    if (alwaysExpanded) {
      setMounted(true);
      setPhase("open");
      return;
    }
    if (wantsExpanded) {
      setMounted(true);
      // Defer phase flip to the next frame so the browser sees a "closed"
      // paint before transitioning to "open" — otherwise no animation runs.
      const raf = requestAnimationFrame(() => setPhase("open"));
      return () => cancelAnimationFrame(raf);
    }
    setPhase("closed");
    // Unmount after the transition ends. 200ms is a hair longer than the
    // 160ms transform so transitionend can fire before we pull the node.
    const t = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(t);
  }, [wantsExpanded, alwaysExpanded]);

  // Any scroll collapses the expanded preview — otherwise the card can stay
  // stuck open if the wrapper moves out from under the cursor silently.
  useEffect(() => {
    if (!isHovered) return;
    const close = () => setIsHovered(false);
    window.addEventListener("scroll", close, { capture: true, passive: true });
    return () => window.removeEventListener("scroll", close, { capture: true });
  }, [isHovered]);

  const isOpen = phase === "open";

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
      {/* Compact card — always rendered so layout stays stable; fades out as
          the expanded card fades/scales in so the transition crossfades. */}
      <div
        className="absolute top-0 left-0 transition-opacity duration-100 ease-out"
        style={{
          width: DISPLAY_SIZE.compact.width,
          height: DISPLAY_SIZE.compact.height,
          opacity: isOpen ? 0 : 1,
        }}
      >
        <CompactModCard
          mod={mod}
          rarity={rarity}
          rank={effectiveRank}
          isMaxRank={isMaxRank}
          drainOverride={drainOverride}
          matchState={matchState}
        />
      </div>

      {/* Expanded card — mounted only while the preview is (or is closing).
          Scale starts at 0.94 to keep PNG/text sharpness (any larger range
          would rasterize at the wrong size and blur during the transition). */}
      {mounted && (
        <div
          className="pointer-events-none absolute left-1/2 z-50"
          style={{
            top: `${COMPACT_CENTER_Y}px`,
            width: DISPLAY_SIZE.expanded.width,
            height: DISPLAY_SIZE.expanded.height,
            transformOrigin: "center center",
            transform: `translate(-50%, -50%) scale(${isOpen ? 1 : 0.94})`,
            opacity: isOpen ? 1 : 0,
            transition:
              "transform 160ms cubic-bezier(0.2, 0.8, 0.2, 1), opacity 120ms linear",
            willChange: "transform, opacity",
            filter: "drop-shadow(0 0 20px rgba(0,0,0,0.8))",
          }}
        >
          <ExpandedModCard
            mod={mod}
            rarity={rarity}
            rank={effectiveRank}
            isMaxRank={isMaxRank}
            setCount={setCount}
            drainOverride={drainOverride}
            matchState={matchState}
          />
        </div>
      )}
    </div>
  );
}
