"use client";

import { memo, useState, useEffect, useCallback, useRef } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getArcaneImageUrl } from "@/lib/warframe/arcane-images";
import type { Arcane } from "@/lib/warframe/types";

// =============================================================================
// RARITY TYPES
// =============================================================================

type ArcaneRarity = "Common" | "Uncommon" | "Rare" | "Legendary";

const RARITY_COLOR_MAP: Record<ArcaneRarity, string> = {
  Common: "#C79989",
  Uncommon: "#BEC0C2",
  Rare: "#FBECC4",
  Legendary: "#D4A5FF",
};

const RARITY_BORDER_MAP: Record<ArcaneRarity, string> = {
  Common: "border-amber-700/60",
  Uncommon: "border-gray-400/60",
  Rare: "border-yellow-500/60",
  Legendary: "border-purple-400/60",
};

const RARITY_BG_MAP: Record<ArcaneRarity, string> = {
  Common: "from-amber-950/80 to-amber-950/40",
  Uncommon: "from-gray-800/80 to-gray-800/40",
  Rare: "from-yellow-950/80 to-yellow-950/40",
  Legendary: "from-purple-950/80 to-purple-950/40",
};

const RARITY_GLOW_MAP: Record<ArcaneRarity, string> = {
  Common: "shadow-amber-700/20",
  Uncommon: "shadow-gray-400/20",
  Rare: "shadow-yellow-500/30",
  Legendary: "shadow-purple-400/40",
};

// =============================================================================
// ARCANE CARD PROPS
// =============================================================================

export interface ArcaneCardProps {
  arcane: Arcane;
  rank?: number;
  onRankChange?: (rank: number) => void;
  isSelected?: boolean;
  isDisabled?: boolean;
  onClick?: () => void;
  className?: string;
  disableHover?: boolean;
}

// Helper to get stats at a given rank
function getArcaneStats(arcane: Arcane, rank: number): string[] {
  if (!arcane.levelStats || arcane.levelStats.length === 0) return [];
  const levelIndex = Math.min(rank, arcane.levelStats.length - 1);
  return arcane.levelStats[levelIndex]?.stats ?? [];
}

function getMaxRank(arcane: Arcane): number {
  return arcane.levelStats ? arcane.levelStats.length - 1 : 5;
}

// =============================================================================
// MAIN ARCANE CARD COMPONENT
// =============================================================================

function ArcaneCardComponent({
  arcane,
  rank: externalRank,
  onRankChange,
  isSelected,
  className,
  disableHover = false,
}: ArcaneCardProps) {
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

  const maxRank = getMaxRank(arcane);
  const [internalRank, setInternalRank] = useState(maxRank);
  const rarity = (arcane.rarity as ArcaneRarity) ?? "Common";

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
    }, 80);
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

    hoverTimeoutRef.current = window.setTimeout(() => {
      if (!cardRef.current) return;
      if (!cardRef.current.matches(":hover")) return;

      setIsHovered(true);
      setShowOverlay(true);
      setIsFadingOverlay(false);

      const rect = cardRef.current.getBoundingClientRect();
      setCoords({
        top: rect.top + rect.height / 2,
        left: rect.left + rect.width / 2,
      });
    }, 50);
  }, [disableHover]);

  const handleMouseLeave = useCallback(() => {
    if (disableHover) return;
    clearHoverTimeout();
    setIsHovered(false);
    if (showOverlay) {
      if (isFadingOverlay) return;
      startOverlayFadeOut();
    }
  }, [disableHover, showOverlay, isFadingOverlay, startOverlayFadeOut]);

  // Close overlay on scroll
  useEffect(() => {
    if (!showOverlay) return;

    const handleScroll = () => {
      setIsHovered(false);
      startOverlayFadeOut();
    };

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
      className={cn("relative w-[120px] h-[140px] select-none", className)}
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
        <CompactArcaneCard
          arcane={arcane}
          rarity={rarity}
          rank={currentRank}
          isMaxRank={isMaxRank}
        />
      </div>

      {/* Expanded card overlay, portal to body */}
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
                isFadingOverlay ? "opacity-0" : "opacity-100 animate-in fade-in zoom-in-90"
              )}
              style={{
                willChange: "transform, opacity",
                transition: isFadingOverlay
                  ? "opacity 80ms ease-out, transform 80ms ease-out"
                  : "opacity 120ms cubic-bezier(0.16, 1, 0.3, 1), transform 120ms cubic-bezier(0.16, 1, 0.3, 1)",
                transform: isFadingOverlay ? "scale(0.95)" : "scale(1)",
              }}
            >
              <ExpandedArcaneCard
                arcane={arcane}
                rarity={rarity}
                rank={currentRank}
                isMaxRank={isMaxRank}
              />
            </div>
          </div>,
          portalContainer
        )}
    </div>
  );
}

// =============================================================================
// COMPACT ARCANE CARD
// =============================================================================

export interface CompactArcaneCardProps {
  arcane: Arcane;
  rarity: ArcaneRarity;
  rank: number;
  isMaxRank: boolean;
  disableAnimation?: boolean;
}

export function CompactArcaneCard({
  arcane,
  rarity,
  rank,
  isMaxRank,
}: CompactArcaneCardProps) {
  const maxRank = getMaxRank(arcane);

  return (
    <div
      className={cn(
        "relative w-[120px] h-[140px] flex flex-col items-center select-none rounded-lg overflow-hidden",
        "border",
        RARITY_BORDER_MAP[rarity],
        "shadow-lg",
        RARITY_GLOW_MAP[rarity]
      )}
      style={{
        isolation: "isolate",
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
      }}
    >
      {/* Background gradient */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-b",
          RARITY_BG_MAP[rarity]
        )}
      />

      {/* Arcane Image - Top */}
      <div className="relative w-[72px] h-[72px] z-10 rounded overflow-hidden mt-2">
        <Image
          src={getArcaneImageUrl(arcane.name)}
          alt={arcane.name}
          fill
          className="object-cover"
          unoptimized
        />
      </div>

      {/* Arcane Name - Below image */}
      <span
        className="relative z-20 text-[11px] font-medium leading-tight text-center px-2 mt-1 line-clamp-2"
        style={{
          fontFamily: "Roboto, sans-serif",
          color: RARITY_COLOR_MAP[rarity],
          textShadow: "0 0 8px rgba(0,0,0,1), 0 2px 4px rgba(0,0,0,1)",
        }}
      >
        {arcane.name}
      </span>

      {/* Rank Dots - bottom */}
      <div className="absolute bottom-[6px] left-1/2 -translate-x-1/2 z-30 flex gap-0.5">
        {Array.from({ length: maxRank + 1 }, (_, i) => (
          <div
            key={i}
            className={cn(
              "w-[5px] h-[5px] rounded-full transition-colors",
              i <= rank ? "bg-[#a8d4ff]" : "bg-gray-700/60"
            )}
            style={
              i <= rank
                ? {
                    boxShadow: "0 0 2px 0.5px rgba(120, 180, 255, 0.6)",
                  }
                : undefined
            }
          />
        ))}
      </div>

      {/* Max Rank Indicator */}
      {isMaxRank && (
        <div className="absolute bottom-[14px] left-1/2 -translate-x-1/2 w-[60%] h-[1px] bg-gradient-to-r from-transparent via-[#a8d4ff] to-transparent opacity-60" />
      )}
    </div>
  );
}

// =============================================================================
// EXPANDED ARCANE CARD
// =============================================================================

type ExpandedArcaneCardProps = CompactArcaneCardProps;

function ExpandedArcaneCard({
  arcane,
  rarity,
  rank,
  isMaxRank,
}: ExpandedArcaneCardProps) {
  const stats = getArcaneStats(arcane, rank);
  const maxRank = getMaxRank(arcane);

  // Format stats: replace \n with <br/>
  const formattedStats = stats
    .map((s) => s.replace(/\\n/g, "<br/>"))
    .join("<br/>");

  return (
    <div
      className={cn(
        "relative w-[200px] select-none rounded-lg overflow-hidden",
        "border",
        RARITY_BORDER_MAP[rarity],
        "shadow-xl",
        RARITY_GLOW_MAP[rarity]
      )}
      style={{
        isolation: "isolate",
        transform: "translateZ(0)",
        backfaceVisibility: "hidden",
      }}
    >
      {/* Background gradient */}
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-b",
          RARITY_BG_MAP[rarity]
        )}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center p-3">
        {/* Arcane Image */}
        <div className="relative w-[80px] h-[80px] rounded-lg overflow-hidden mb-2">
          <Image
            src={getArcaneImageUrl(arcane.name)}
            alt={arcane.name}
            fill
            className="object-cover"
            unoptimized
          />
        </div>

        {/* Arcane Name */}
        <span
          className="text-[14px] font-medium text-center leading-tight mb-1"
          style={{
            fontFamily: "Roboto, sans-serif",
            color: RARITY_COLOR_MAP[rarity],
          }}
        >
          {arcane.name}
        </span>

        {/* Rarity Badge */}
        <span
          className="text-[9px] uppercase tracking-wider mb-2 opacity-70"
          style={{ color: RARITY_COLOR_MAP[rarity] }}
        >
          {rarity}
        </span>

        {/* Stats */}
        {formattedStats && (
          <div className="w-full px-1 border-t border-white/10 pt-2 mt-1">
            <span className="text-[9px] text-gray-400 uppercase tracking-wider block mb-1 text-center">
              Rank {rank}
            </span>
            <span
              className="text-[11px] text-gray-300 text-center leading-tight block"
              style={{ fontFamily: "Roboto, sans-serif" }}
              dangerouslySetInnerHTML={{ __html: formattedStats }}
            />
          </div>
        )}

        {/* Rank Dots */}
        <div className="flex gap-0.5 mt-3">
          {Array.from({ length: maxRank + 1 }, (_, i) => (
            <div
              key={i}
              className={cn(
                "w-[6px] h-[6px] rounded-full transition-colors",
                i <= rank ? "bg-[#a8d4ff]" : "bg-gray-700/60"
              )}
              style={
                i <= rank
                  ? {
                      boxShadow: "0 0 3px 1px rgba(120, 180, 255, 0.6)",
                    }
                  : undefined
              }
            />
          ))}
        </div>

        {/* Max Rank Indicator */}
        {isMaxRank && (
          <div className="w-[70%] h-[1px] bg-gradient-to-r from-transparent via-[#a8d4ff] to-transparent opacity-60 mt-2" />
        )}
      </div>
    </div>
  );
}

export const ArcaneCard = memo(ArcaneCardComponent);

// =============================================================================
// DRAG GHOST COMPONENT
// =============================================================================

export interface ArcaneDragGhostProps {
  arcane: { name: string; rarity?: string };
}

export function ArcaneDragGhost({ arcane }: ArcaneDragGhostProps) {
  const rarity = (arcane.rarity || "Common") as ArcaneRarity;

  return (
    <div
      className={cn(
        "w-[184px] h-[64px] rounded-lg border flex items-center justify-center px-3",
        "backdrop-blur-sm shadow-xl cursor-grabbing",
        RARITY_BORDER_MAP[rarity],
        "bg-gradient-to-b",
        RARITY_BG_MAP[rarity]
      )}
    >
      <span
        className="text-sm font-medium text-center truncate"
        style={{ color: RARITY_COLOR_MAP[rarity] }}
      >
        {arcane.name}
      </span>
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { ArcaneRarity };
