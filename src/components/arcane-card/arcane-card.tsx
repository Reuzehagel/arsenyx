"use client"

import Image from "next/image"
import { memo, useState, useEffect, useCallback, useRef } from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { getArcaneImageUrl } from "@/lib/warframe/arcane-images"
import type { Arcane } from "@/lib/warframe/types"

// =============================================================================
// RARITY TYPES
// =============================================================================

type ArcaneRarity = "Common" | "Uncommon" | "Rare" | "Legendary"

// =============================================================================
// ARCANE CARD PROPS
// =============================================================================

export interface ArcaneCardProps {
  arcane: Arcane
  rank?: number
  onRankChange?: (rank: number) => void
  isSelected?: boolean
  isDisabled?: boolean
  onClick?: () => void
  className?: string
  disableHover?: boolean
}

// Helper to get stats at a given rank
function getArcaneStats(arcane: Arcane, rank: number): string[] {
  if (!arcane.levelStats || arcane.levelStats.length === 0) return []
  const levelIndex = Math.min(rank, arcane.levelStats.length - 1)
  return arcane.levelStats[levelIndex]?.stats ?? []
}

function getMaxRank(arcane: Arcane): number {
  return arcane.levelStats ? arcane.levelStats.length - 1 : 5
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
  const maxRank = getMaxRank(arcane)
  const rarity = (arcane.rarity as ArcaneRarity) ?? "Common"
  const [internalRank, setInternalRank] = useState(maxRank)
  const currentRank = externalRank ?? internalRank
  const [isHovered, setIsHovered] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const handleRankChange = useCallback(
    (newRank: number) => {
      const clampedRank = Math.max(0, Math.min(newRank, maxRank))
      if (onRankChange) {
        onRankChange(clampedRank)
      } else {
        setInternalRank(clampedRank)
      }
    },
    [maxRank, onRankChange],
  )

  // Handle keyboard events for rank adjustment when hovered
  useEffect(() => {
    if (!isHovered || disableHover) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "-" || e.key === "_") {
        e.preventDefault()
        handleRankChange(currentRank - 1)
      } else if (e.key === "=" || e.key === "+") {
        e.preventDefault()
        handleRankChange(currentRank + 1)
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isHovered, disableHover, currentRank, handleRankChange])

  // Get stats for tooltip
  const stats = getArcaneStats(arcane, currentRank)
  const formattedStats = stats.map((s) => s.replace(/\\n/g, "\n")).join("\n")

  const cardContent = (
    <div
      ref={cardRef}
      className={cn(
        "bg-card/80 relative flex h-[100px] w-[140px] flex-col items-center overflow-hidden rounded-md select-none",
        isSelected &&
          "ring-primary ring-offset-background ring-2 ring-offset-1",
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Arcane Image - centered, smaller */}
      <div className="relative mt-1.5 h-[65px] w-[80px] overflow-hidden rounded">
        <Image
          src={getArcaneImageUrl(arcane.name)}
          alt={arcane.name}
          fill
          sizes="80px"
          className="object-cover"
          unoptimized
        />
      </div>

      {/* Arcane Name */}
      <span className="text-foreground mt-1 line-clamp-1 px-1 text-center text-[10px] leading-tight font-medium">
        {arcane.name}
      </span>

      {/* Rank Display */}
      <span className="text-muted-foreground mt-0.5 text-[9px] font-medium">
        RANK {currentRank}
      </span>
    </div>
  )

  if (disableHover || !formattedStats) {
    return cardContent
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
            <div className="text-xs leading-relaxed whitespace-pre-wrap opacity-80">
              {formattedStats}
            </div>
            {onRankChange && (
              <div className="border-t border-current/20 pt-1 text-[9px] opacity-50">
                Press +/- to change rank
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

export const ArcaneCard = memo(ArcaneCardComponent)

// =============================================================================
// DRAG GHOST COMPONENT
// =============================================================================

export interface ArcaneDragGhostProps {
  arcane: { name: string; rarity?: string }
}

export function ArcaneDragGhost({ arcane }: ArcaneDragGhostProps) {
  return (
    <div
      className={cn(
        "flex h-[36px] w-[140px] items-center justify-center rounded-md px-2",
        "bg-card cursor-grabbing shadow-lg",
      )}
    >
      <span className="text-foreground truncate text-center text-xs font-medium">
        {arcane.name}
      </span>
    </div>
  )
}

// =============================================================================
// EXPORTS
// =============================================================================

export type { ArcaneRarity }
