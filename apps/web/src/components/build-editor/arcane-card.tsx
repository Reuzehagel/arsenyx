import type { Arcane } from "@arsenyx/shared/warframe/types"
import { useState } from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getArcaneImageUrl } from "@/lib/arcane-images"
import { cn } from "@/lib/utils"

import { useRankHotkey } from "./use-rank-hotkey"

function statsAt(arcane: Arcane, rank: number): string[] {
  if (!arcane.levelStats || arcane.levelStats.length === 0) return []
  const i = Math.min(rank, arcane.levelStats.length - 1)
  return arcane.levelStats[i]?.stats ?? []
}

interface ArcaneCardProps {
  arcane: Arcane
  rank: number
  /** Called with -1/+1 when the user presses -/+ while hovering. Caller clamps. */
  onRankChange?: (delta: -1 | 1) => void
  onClick?: () => void
  isSelected?: boolean
  disableHover?: boolean
  className?: string
}

export function ArcaneCard({
  arcane,
  rank: currentRank,
  onRankChange,
  onClick,
  isSelected,
  disableHover = false,
  className,
}: ArcaneCardProps) {
  const [hovered, setHovered] = useState(false)

  useRankHotkey({
    enabled: hovered && !disableHover && !!onRankChange,
    onDelta: (d) => onRankChange?.(d),
  })

  const stats = statsAt(arcane, currentRank)
  const formattedStats = stats.map((s) => s.replace(/\\n/g, "\n")).join("\n")

  const card = (
    <div
      className={cn(
        "bg-card/80 relative flex h-[100px] w-[140px] flex-col items-center overflow-hidden rounded-md select-none",
        onClick && "cursor-pointer",
        isSelected &&
          "ring-primary ring-offset-background ring-2 ring-offset-1",
        className,
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={onClick}
    >
      <div className="relative mt-1.5 h-[65px] w-[80px] overflow-hidden rounded">
        <img
          src={getArcaneImageUrl(arcane.name)}
          alt={arcane.name}
          className="h-full w-full object-cover"
        />
      </div>
      <span className="text-foreground mt-1 line-clamp-1 px-1 text-center text-[10px] leading-tight font-medium">
        {arcane.name}
      </span>
      <span className="text-muted-foreground mt-0.5 text-[9px] font-medium">
        RANK {currentRank}
      </span>
    </div>
  )

  if (disableHover || !formattedStats) return card

  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger render={card} />
        <TooltipContent
          side="bottom"
          className="max-w-[280px] p-3"
          sideOffset={4}
        >
          <div className="flex flex-col gap-2">
            <div className="font-medium">{arcane.name}</div>
            <div className="text-[10px] uppercase opacity-70">
              {arcane.rarity} · Rank {currentRank}
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
