"use client";

import {
  memo,
  useState,
  useEffect,
  useLayoutEffect,
  useCallback,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getImageUrl } from "@/lib/warframe/images";
import type { Mod, Polarity } from "@/lib/warframe/types";

// =============================================================================
// RANK COMPLETE LINE COMPONENT WITH ANIMATION
// =============================================================================

function RankCompleteLine({
  rarity,
  className,
  disableAnimation = false,
}: {
  rarity: ModRarity;
  className?: string;
  disableAnimation?: boolean;
}) {
  return (
    <div className={cn("overflow-hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={`/mod-components/${RARITY_ASSET_MAP[rarity].folder}/RankCompleteLine.png`}
        alt="Max Rank"
        className="w-full"
        style={{
          maskImage:
            "linear-gradient(90deg, transparent 0%, white 50%, transparent 100%)",
          maskSize: disableAnimation ? "200% 100%" : "0% 100%",
          maskPosition: "center",
          maskRepeat: "no-repeat",
          WebkitMaskImage:
            "linear-gradient(90deg, transparent 0%, white 50%, transparent 100%)",
          WebkitMaskSize: disableAnimation ? "200% 100%" : "0% 100%",
          WebkitMaskPosition: "center",
          WebkitMaskRepeat: "no-repeat",
          animation: disableAnimation
            ? "none"
            : "rankReveal 0.4s ease-out forwards",
        }}
      />
      <style jsx>{`
        @keyframes rankReveal {
          0% {
            mask-size: 0% 100%;
            -webkit-mask-size: 0% 100%;
          }
          100% {
            mask-size: 200% 100%;
            -webkit-mask-size: 200% 100%;
          }
        }
      `}</style>
    </div>
  );
}

// =============================================================================
// RARITY TYPES
// =============================================================================

type ModRarity = "Common" | "Uncommon" | "Rare" | "Legendary" | "Peculiar";

// Map rarity to asset folder and prefix
const RARITY_ASSET_MAP: Record<ModRarity, { folder: string; prefix: string }> =
  {
    Common: { folder: "common", prefix: "Bronze" },
    Uncommon: { folder: "uncommon", prefix: "Silver" },
    Rare: { folder: "rare", prefix: "Gold" },
    Legendary: { folder: "legendary", prefix: "Legendary" },
    Peculiar: { folder: "legendary", prefix: "Legendary" }, // Peculiar uses Legendary assets
  };

// Map rarity to text color
const RARITY_COLOR_MAP: Record<ModRarity, string> = {
  Common: "#C79989",
  Uncommon: "#BEC0C2",
  Rare: "#FBECC4",
  Legendary: "#DFDFDF",
  Peculiar: "#DFDFDF", // Peculiar uses Legendary color
};

function getModAssetUrl(rarity: ModRarity, asset: string): string {
  const { folder, prefix } = RARITY_ASSET_MAP[rarity];
  return `/mod-components/${folder}/${prefix}${asset}.png`;
}

// =============================================================================
// POLARITY HELPERS
// =============================================================================

const POLARITY_ICON_MAP: Record<Polarity, string> = {
  madurai: "Madurai_Pol.svg",
  vazarin: "Vazarin_Pol.svg",
  naramon: "Naramon_Pol.svg",
  zenurik: "Zenurik_Pol.svg",
  unairu: "Unairu_Pol.svg",
  penjaga: "Penjaga_Pol.svg",
  umbra: "Umbra_Pol.svg",
  universal: "Any_Pol.svg",
};

function getPolarityIcon(polarity: Polarity): string {
  const filename = POLARITY_ICON_MAP[polarity] || "Any_Pol.svg";
  return `/focus-schools/${filename}`;
}

// =============================================================================
// MOD DRAIN BADGE COMPONENT
// =============================================================================

interface ModDrainBadgeProps {
  mod: Mod;
  rank: number;
  rarity: ModRarity;
  drainOverride?: number;
  matchState?: "match" | "mismatch" | "neutral";
}

function ModDrainBadge({
  mod,
  rank,
  rarity,
  drainOverride,
  matchState = "neutral",
}: ModDrainBadgeProps) {
  const drain = drainOverride ?? mod.baseDrain + rank;
  const badgeColor =
    matchState === "match"
      ? "#4ade80" // Green for matching polarity
      : matchState === "mismatch"
      ? "#f87171" // Red for mismatched polarity
      : RARITY_COLOR_MAP[rarity];
  const glow =
    matchState === "match"
      ? "0 0 8px rgba(74, 222, 128, 0.45)"
      : matchState === "mismatch"
      ? "0 0 8px rgba(248, 113, 113, 0.45)"
      : undefined;

  return (
    <div className="absolute top-[7px] right-[2px] z-30 flex items-center justify-center">
      {/* Backer Image */}
      <Image
        src={getModAssetUrl(rarity, "TopRightBacker")}
        alt=""
        width={36}
        height={18}
        className="pointer-events-none"
        priority={false}
      />

      {/* Content Container */}
      <div className="absolute inset-0 flex items-center justify-center gap-[1px] pt-[0.5px] pl-[3px]">
        {/* Drain Value */}
        <span
          className="text-[12px] font-bold leading-none tracking-tighter"
          style={{
            fontFamily: "Roboto, sans-serif",
            color: badgeColor,
            textShadow: glow,
          }}
        >
          {drain}
        </span>

        {/* Polarity Icon */}
        <div
          className="relative w-[13px] h-[13px]"
          style={{
            backgroundColor: badgeColor,
            maskImage: `url(${getPolarityIcon(mod.polarity)})`,
            maskSize: "contain",
            maskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskImage: `url(${getPolarityIcon(mod.polarity)})`,
            WebkitMaskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
          }}
        />
      </div>
    </div>
  );
}

// =============================================================================
// MOD CARD COMPONENT
// =============================================================================

export interface ModCardProps {
  mod: Mod;
  rank?: number;
  onRankChange?: (rank: number) => void;
  isSelected?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
  className?: string;
  setCount?: number;
  /** Skip heavy hover/portal rendering (used while dragging) */
  disableHover?: boolean;
  /** Computed drain from slot (accounts for polarity) */
  drainOverride?: number;
  /** Polarity match state for color feedback */
  matchState?: "match" | "mismatch" | "neutral";
}

// Helper to get stats at a given rank
function getModStats(mod: Mod, rank: number, setCount: number = 0): string[] {
  if (!mod.levelStats || mod.levelStats.length === 0) return [];
  const levelIndex = Math.min(rank, mod.levelStats.length - 1);
  const baseStats = mod.levelStats[levelIndex]?.stats ?? [];

  // Handle Umbral Set Bonus Scaling
  if (
    mod.modSet === "/Lotus/Upgrades/Mods/Sets/Umbra/UmbraSetMod" &&
    setCount > 1
  ) {
    // Determine multiplier
    let multiplier = 1.0;
    const isIntensify = mod.name.includes("Intensify");

    if (setCount === 2) {
      multiplier = isIntensify ? 1.25 : 1.3;
    } else if (setCount >= 3) {
      multiplier = isIntensify ? 1.75 : 1.8;
    }

    return baseStats.map((stat) => {
      // Regex to find numbers (including decimals)
      return stat.replace(/(\d+(\.\d+)?)/g, (match) => {
        const value = parseFloat(match);
        const boosted = value * multiplier;
        // Round to 1 decimal place, strip trailing zero
        return parseFloat(boosted.toFixed(1)).toString();
      });
    });
  }

  return baseStats;
}

function ModCardComponent({
  mod,
  rank: externalRank,
  onRankChange,
  isSelected,
  className,
  setCount = 0,
  disableHover = false,
  drainOverride,
  matchState = "neutral",
}: ModCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [portalContainer] = useState<HTMLElement | null>(() =>
    typeof document === "undefined" ? null : document.body
  );
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [showOverlay, setShowOverlay] = useState(false);
  const [isFadingOverlay, setIsFadingOverlay] = useState(false);
  const fadeTimeoutRef = useRef<number | null>(null);
  const hoverTimeoutRef = useRef<number | null>(null);

  const maxRank = mod.fusionLimit ?? 0;
  const [internalRank, setInternalRank] = useState(maxRank);
  const rarity = (mod.rarity as ModRarity) ?? "Common";

  // Use external rank if provided, otherwise use internal state
  const currentRank = externalRank ?? internalRank;
  const isMaxRank = currentRank >= maxRank;

  const handleRankChange = useCallback(
    (newRank: number) => {
      const clampedRank = Math.max(0, Math.min(newRank, maxRank));
      if (onRankChange) {
        onRankChange(clampedRank);
      } else {
        setInternalRank(clampedRank);
      }
    },
    [maxRank, onRankChange]
  );

  const clearFadeTimeout = () => {
    if (fadeTimeoutRef.current) {
      window.clearTimeout(fadeTimeoutRef.current);
      fadeTimeoutRef.current = null;
    }
  };

  const clearHoverTimeout = () => {
    if (hoverTimeoutRef.current) {
      window.clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
  };

  const startOverlayFadeOut = useCallback(() => {
    clearFadeTimeout();
    setIsFadingOverlay(true);
    fadeTimeoutRef.current = window.setTimeout(() => {
      setShowOverlay(false);
      setIsFadingOverlay(false);
      fadeTimeoutRef.current = null;
    }, 80); // Reduced from 100ms for snappier feel
  }, []);

  // Handle keyboard events for rank adjustment
  useEffect(() => {
    if (!isHovered || disableHover) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        handleRankChange(currentRank - 1);
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        handleRankChange(currentRank + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isHovered, disableHover, currentRank, handleRankChange]);

  const handleMouseEnter = useCallback(() => {
    if (disableHover) return;
    clearFadeTimeout();
    clearHoverTimeout();

    // Debounce hover activation - only show expanded view if hovering for 50ms+
    // This prevents jitter when quickly swiping across multiple cards while feeling responsive
    hoverTimeoutRef.current = window.setTimeout(() => {
      if (!cardRef.current) return;

      // Double-check we're still actually hovering before activating
      if (!cardRef.current.matches(":hover")) return;

      setIsHovered(true);
      setShowOverlay(true);
      setIsFadingOverlay(false);

      const rect = cardRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + rect.height / 2,
        left: rect.left + rect.width / 2,
      });
    }, 50); // Reduced from 80ms for more responsive feel
  }, [disableHover]);

  const handleMouseLeave = useCallback(() => {
    if (disableHover) return;
    clearHoverTimeout(); // Cancel pending hover activation
    setIsHovered(false);
    if (showOverlay) {
      // If we're leaving quickly, skip the fade animation
      if (isFadingOverlay) {
        // Already fading, let it continue
        return;
      }
      startOverlayFadeOut();
    }
  }, [disableHover, showOverlay, isFadingOverlay, startOverlayFadeOut]);

  // When hover rendering is disabled during drag, gracefully fade the overlay
  // Using useLayoutEffect because this needs to sync with visual state before paint
  // The cascading render here is intentional - we need to immediately clear visual hover state when drag starts
  useLayoutEffect(() => {
    if (disableHover && showOverlay) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Intentional: must sync hover state with parent's disableHover prop
      setIsHovered(false);
      startOverlayFadeOut();
    }
  }, [disableHover, showOverlay, startOverlayFadeOut]);

  // Close overlay on any scroll to prevent position desync
  useEffect(() => {
    if (!showOverlay) return;

    const handleScroll = () => {
      setIsHovered(false);
      startOverlayFadeOut();
    };

    // Listen on capture phase to catch all scroll events
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [showOverlay, startOverlayFadeOut]);

  useEffect(() => {
    return () => {
      clearFadeTimeout();
      clearHoverTimeout();
    };
  }, []);

  return (
    <div
      ref={cardRef}
      className={cn("relative w-[184px] h-[64px] select-none", className)}
      style={{
        isolation: "isolate",
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
      }}
      onMouseEnter={disableHover ? undefined : handleMouseEnter}
      onMouseLeave={disableHover ? undefined : handleMouseLeave}
    >
      {/* Compact card - hidden when hovered */}
      <div
        className={cn(
          "transition-opacity duration-150 ease-out",
          isHovered ? "opacity-0" : "opacity-100",
          isSelected && "filter drop-shadow-[0_0_6px_rgba(255,255,255,0.7)]"
        )}
        style={{ willChange: isHovered ? "opacity" : "auto" }}
      >
        <CompactModCard
          mod={mod}
          rarity={rarity}
          rank={currentRank}
          isMaxRank={isMaxRank}
          drainOverride={drainOverride}
          matchState={matchState}
        />
      </div>

      {/* Expanded card overlays, portal to body to avoid clipping */}
      {showOverlay &&
        portalContainer &&
        createPortal(
          <div
            className="fixed z-[9999] pointer-events-none"
            style={{
              top: coords.top,
              left: coords.left,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div
              className={cn(
                "origin-center",
                "drop-shadow-[0_0_20px_rgba(0,0,0,0.8)] shadow-2xl",
                isFadingOverlay
                  ? "opacity-0"
                  : "opacity-100 animate-in fade-in zoom-in-90"
              )}
              style={{
                willChange: "transform, opacity",
                transition: isFadingOverlay
                  ? "opacity 80ms ease-out, transform 80ms ease-out"
                  : "opacity 120ms cubic-bezier(0.16, 1, 0.3, 1), transform 120ms cubic-bezier(0.16, 1, 0.3, 1)",
                transform: isFadingOverlay ? "scale(0.95)" : "scale(1)",
              }}
            >
              <ExpandedModCard
                mod={mod}
                rarity={rarity}
                rank={currentRank}
                isMaxRank={isMaxRank}
                setCount={setCount}
                drainOverride={drainOverride}
                matchState={matchState}
              />
            </div>
          </div>,
          portalContainer
        )}
    </div>
  );
}

// =============================================================================
// COMPACT MOD CARD (Just frames)
// =============================================================================

export interface CompactModCardProps {
  mod: Mod;
  rarity: ModRarity;
  rank: number;
  isMaxRank: boolean;
  /** Skip animation for instant render (used in drag overlay) */
  disableAnimation?: boolean;
  /** Computed drain from slot (accounts for polarity) */
  drainOverride?: number;
  /** Polarity match state for color feedback */
  matchState?: "match" | "mismatch" | "neutral";
}

export function CompactModCard({
  mod,
  rarity,
  rank,
  isMaxRank,
  disableAnimation = false,
  drainOverride,
  matchState = "neutral",
}: CompactModCardProps) {
  const maxRank = mod.fusionLimit ?? 0;

  return (
    <div
      className="relative w-[184px] h-[64px] flex items-center justify-center select-none"
      style={{
        isolation: "isolate",
        transformOrigin: "center center",
        transform: "translateZ(0)", // Force GPU compositing layer
        backfaceVisibility: "hidden", // Prevents subpixel rendering issues
      }}
    >
      {/* Drain & Polarity Badge */}
      <ModDrainBadge
        mod={mod}
        rank={rank}
        rarity={rarity}
        drainOverride={drainOverride}
        matchState={matchState}
      />
      {/* Mod Image */}
      <div className="absolute top-[4px] left-[3px] right-[3px] -bottom-4 z-10 overflow-hidden rounded-b-[5px]">
        <Image
          src={getImageUrl(mod.imageName)}
          alt={mod.name}
          fill
          className="object-cover object-top transition-[filter] duration-150 ease-in-out"
          style={{
            filter: "grayscale(0.7) brightness(0.5)",
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none opacity-25"
          style={{
            backgroundColor: RARITY_COLOR_MAP[rarity],
            mixBlendMode: "hard-light",
          }}
        />
      </div>
      {/* Top Frame */}
      <Image
        src={getModAssetUrl(rarity, "FrameTop")}
        alt="Top Frame"
        width={184}
        height={44}
        className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
        priority={false}
      />
      {/* Mod Name */}
      <span
        className="absolute top-[70%] left-1/2 -translate-x-1/2 -translate-y-1/2 z-30 text-[16px] font-normal text-center w-[170px] leading-tight line-clamp-2"
        style={{
          fontFamily: "Roboto, sans-serif",
          color: RARITY_COLOR_MAP[rarity],
          textShadow:
            "0 0 8px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.9), 0 2px 4px rgba(0,0,0,1)",
        }}
      >
        {mod.name}
      </span>
      {/* Bottom Frame */}
      <Image
        src={getModAssetUrl(rarity, "FrameBottom")}
        alt="Bottom Frame"
        width={184}
        height={64}
        className="absolute -bottom-8 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
        priority={false}
      />

      {/* Rank Complete Line - shown when at max rank, on bottom frame behind dots */}
      {isMaxRank && (
        <RankCompleteLine
          rarity={rarity}
          className="absolute -bottom-[28px] left-1/2 -translate-x-1/2 z-25 w-[calc(100%-8px)]"
          disableAnimation={disableAnimation}
        />
      )}

      {/* Rank Dots - positioned on top of bottom frame */}
      {maxRank > 0 && (
        <div className="absolute -bottom-[27px] left-1/2 -translate-x-1/2 z-30 flex gap-0.5">
          {Array.from({ length: maxRank }, (_, i) => (
            <div
              key={i}
              className={cn(
                "w-[5px] h-[5px] rounded-full",
                i < rank ? "bg-[#a8d4ff]" : "bg-gray-800/60"
              )}
              style={
                i < rank
                  ? {
                      boxShadow: "0 0 2px 0.5px rgba(120, 180, 255, 0.6)",
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// EXPANDED MOD CARD (Vertical frames, on hover)
// =============================================================================

interface ExpandedModCardProps extends CompactModCardProps {
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
}: ExpandedModCardProps) {
  const stats = getModStats(mod, rank, setCount); // Show stats for current rank
  const maxRank = mod.fusionLimit ?? 0;
  const compatLabel =
    mod.compatName ||
    (mod.type ? mod.type.replace(" Mod", "").toUpperCase() : "");

  // Format stats: replace \n with <br/> and join multiple stats
  const formattedStats = stats
    .map((s) => s.replace(/\\n/g, "<br/>"))
    .join("<br/>");

  // Set Bonus Logic
  const setStats = mod.modSetStats || [];
  const maxSetSize = setStats.length;

  const currentBonusIndex = Math.min(Math.max(0, setCount - 1), maxSetSize - 1);
  const currentBonus =
    setStats.length > 0
      ? setStats[currentBonusIndex].replace(/\\n/g, "<br/>")
      : null;

  const showMax = maxSetSize > 1 && setCount < maxSetSize;
  const maxBonus =
    setStats.length > 0
      ? setStats[maxSetSize - 1].replace(/\\n/g, "<br/>")
      : null;

  return (
    <div
      className="relative w-[184px] h-[285px] select-none"
      style={{
        isolation: "isolate",
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
      }}
    >
      {/* Drain & Polarity Badge */}
      <ModDrainBadge
        mod={mod}
        rank={rank}
        rarity={rarity}
        drainOverride={drainOverride}
        matchState={matchState}
      />
      {/* Top Frame */}
      <Image
        src={getModAssetUrl(rarity, "FrameTop")}
        alt="Top Frame"
        width={184}
        height={44}
        className="absolute top-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
        priority={false}
      />

      {/* Mod Image - full card, will be covered by info panel at bottom */}
      <div className="absolute top-[4px] left-[3px] right-[3px] bottom-[4px] z-10 overflow-hidden">
        <Image
          src={getImageUrl(mod.imageName)}
          alt={mod.name}
          fill
          className="object-contain object-top"
        />
      </div>

      {/* Info Panel - positioned at bottom, sized by content */}
      <div className="absolute bottom-[20px] left-[3px] right-[3px] z-15">
        {/* Background Image - stretches to fill content */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <Image
            src={getModAssetUrl(rarity, "Background")}
            alt=""
            width={184}
            height={200}
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full h-full object-cover object-bottom"
            priority={false}
          />
        </div>
        {/* Text Content */}
        <div className="relative z-20 flex flex-col items-center px-2 pt-1.5 pb-2">
          {/* Mod Name */}
          <span
            className="text-[14px] font-normal text-center leading-tight"
            style={{
              fontFamily: "Roboto, sans-serif",
              color: RARITY_COLOR_MAP[rarity],
            }}
          >
            {mod.name}
          </span>
          {/* Stat */}
          {formattedStats && (
            <div className="flex flex-col items-center gap-1 mt-1 w-full px-1">
              <span
                className="text-[11px] font-normal text-gray-300 text-center leading-tight"
                style={{ fontFamily: "Roboto, sans-serif" }}
                dangerouslySetInnerHTML={{ __html: formattedStats }}
              />

              {/* Set Bonuses */}
              {setStats.length > 0 && (
                <div className="flex flex-col gap-1 mt-2 w-full border-t border-white/10 pt-1">
                  {/* Header with dots */}
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider">
                      Set ({setCount || 0}/{maxSetSize})
                    </span>
                    <div className="flex gap-0.5">
                      {Array.from({ length: maxSetSize }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "w-1 h-1 rounded-full border border-white/30",
                            i < setCount ? "bg-white" : "bg-transparent"
                          )}
                        />
                      ))}
                    </div>
                  </div>

                  {/* Current Bonus */}
                  <div className="flex flex-col gap-0.5">
                    {setCount > 0 && setCount < maxSetSize && (
                      <span className="text-[8px] text-gray-500 text-center uppercase">
                        Current
                      </span>
                    )}
                    <span
                      className={cn(
                        "text-[9px] text-center leading-tight",
                        setCount > 0 ? "text-gray-300" : "text-gray-500"
                      )}
                      dangerouslySetInnerHTML={{ __html: currentBonus! }}
                    />
                  </div>

                  {/* Max Bonus Preview */}
                  {showMax && maxBonus && (
                    <div className="flex flex-col gap-0.5 mt-1 opacity-60">
                      <span className="text-[8px] text-gray-500 text-center uppercase">
                        Max ({maxSetSize})
                      </span>
                      <span
                        className="text-[9px] text-gray-500 text-center leading-tight"
                        dangerouslySetInnerHTML={{ __html: maxBonus }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          {/* Lower Tab with Compatibility Badge */}
          <div className="relative mt-1 w-[80%] h-[22px]">
            <Image
              src={getModAssetUrl(rarity, "LowerTab")}
              alt=""
              fill
              sizes="148px"
              className="object-contain"
              priority={false}
            />
            {compatLabel && (
              <span className="absolute inset-0 flex items-center justify-center text-[9px] uppercase tracking-wider text-white">
                {compatLabel}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Frame */}
      <Image
        src={getModAssetUrl(rarity, "FrameBottom")}
        alt="Bottom Frame"
        width={184}
        height={64}
        className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 pointer-events-none"
        priority={false}
      />

      {/* Rank Complete Line - shown when at max rank, on bottom frame behind dots */}
      {isMaxRank && (
        <RankCompleteLine
          rarity={rarity}
          className="absolute bottom-[3px] left-1/2 -translate-x-1/2 z-25 w-[calc(100%-8px)]"
        />
      )}

      {/* Rank Dots - positioned on top of bottom frame */}
      {maxRank > 0 && (
        <div className="absolute bottom-[4px] left-1/2 -translate-x-1/2 z-30 flex gap-0.5">
          {Array.from({ length: maxRank }, (_, i) => (
            <div
              key={i}
              className={cn(
                "w-[5px] h-[5px] rounded-full",
                i < rank ? "bg-[#a8d4ff]" : "bg-gray-800/60"
              )}
              style={
                i < rank
                  ? {
                      boxShadow: "0 0 2px 0.5px rgba(120, 180, 255, 0.6)",
                    }
                  : undefined
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const ModCard = memo(ModCardComponent);

// =============================================================================
// DRAG GHOST COMPONENT - Lightweight drag preview
// =============================================================================

const RARITY_BORDER_MAP: Record<ModRarity, string> = {
  Common: "border-amber-700",
  Uncommon: "border-gray-400",
  Rare: "border-yellow-500",
  Legendary: "border-purple-400",
  Peculiar: "border-purple-400",
};

const RARITY_BG_MAP: Record<ModRarity, string> = {
  Common: "bg-amber-950/90",
  Uncommon: "bg-gray-800/90",
  Rare: "bg-yellow-950/90",
  Legendary: "bg-purple-950/90",
  Peculiar: "bg-purple-950/90",
};

export interface DragGhostProps {
  mod: { name: string; rarity?: string };
  rarity?: string;
}

/**
 * Lightweight drag preview that doesn't load images.
 * Uses CSS styling for rarity indication.
 */
export function DragGhost({ mod, rarity }: DragGhostProps) {
  const modRarity = (rarity || mod.rarity || "Common") as ModRarity;

  return (
    <div
      className={cn(
        "w-[184px] h-[64px] rounded-lg border-2 flex items-center justify-center px-3",
        "backdrop-blur-sm shadow-xl cursor-grabbing",
        RARITY_BORDER_MAP[modRarity],
        RARITY_BG_MAP[modRarity]
      )}
    >
      <span
        className="text-sm font-medium text-center truncate"
        style={{ color: RARITY_COLOR_MAP[modRarity] }}
      >
        {mod.name}
      </span>
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { ModRarity };
