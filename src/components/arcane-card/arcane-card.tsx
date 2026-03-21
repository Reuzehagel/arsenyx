"use client";

import { memo, useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getArcaneImageUrl } from "@/lib/warframe/arcane-images";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { Arcane } from "@/lib/warframe/types";

// =============================================================================
// RARITY TYPES
// =============================================================================

type ArcaneRarity = "Common" | "Uncommon" | "Rare" | "Legendary";

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
  const maxRank = getMaxRank(arcane);
  const rarity = (arcane.rarity as ArcaneRarity) ?? "Common";
  const [internalRank, setInternalRank] = useState(maxRank);
  const currentRank = externalRank ?? internalRank;
  const [isHovered, setIsHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

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

  // Handle keyboard events for rank adjustment when hovered
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

  // Get stats for tooltip
  const stats = getArcaneStats(arcane, currentRank);
  const formattedStats = stats.map((s) => s.replace(/\\n/g, "\n")).join("\n");

  const cardContent = (
    <div
      ref={cardRef}
      className={cn(
        "relative w-[140px] h-[100px] flex flex-col items-center select-none rounded-md overflow-hidden bg-card/80",
        isSelected &&
          "ring-2 ring-primary ring-offset-1 ring-offset-background",
        className
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Arcane Image - centered, smaller */}
      <div className="relative w-[80px] h-[65px] overflow-hidden rounded mt-1.5">
        <Image
          src={getArcaneImageUrl(arcane.name)}
          alt={arcane.name}
          fill
          className="object-cover"
          unoptimized
        />
      </div>

      {/* Arcane Name */}
      <span className="text-[10px] font-medium leading-tight text-center px-1 mt-1 line-clamp-1 text-foreground">
        {arcane.name}
      </span>

      {/* Rank Display */}
      <span className="text-[9px] text-muted-foreground font-medium mt-0.5">
        RANK {currentRank}
      </span>
    </div>
  );

  if (disableHover || !formattedStats) {
    return cardContent;
  }

  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger render={cardContent} />
        <TooltipContent
          side="bottom"
          className="max-w-[280px] p-3"
          sideOffset={4}
        >
          <div className="flex flex-col gap-2">
            <div className="font-medium">{arcane.name}</div>
            <div className="text-[10px] uppercase opacity-70">
              {rarity} • Rank {currentRank}
            </div>
            <div className="text-xs opacity-80 whitespace-pre-wrap leading-relaxed">
              {formattedStats}
            </div>
            {onRankChange && (
              <div className="text-[9px] opacity-50 pt-1 border-t border-current/20">
                Press +/- to change rank
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
  return (
    <div
      className={cn(
        "w-[140px] h-[36px] rounded-md flex items-center justify-center px-2",
        "bg-card shadow-lg cursor-grabbing"
      )}
    >
      <span className="text-xs font-medium text-center truncate text-foreground">
        {arcane.name}
      </span>
    </div>
  );
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { ArcaneRarity };
