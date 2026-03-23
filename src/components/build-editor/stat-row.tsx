"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { formatDisplayValue, type StatFormat } from "@/lib/warframe/formatting"
import type { StatValue } from "@/lib/warframe/stat-types"

import { StatBreakdownTooltip } from "./stat-breakdown"

// Re-export StatFormat for backwards compatibility
export type { StatFormat }

interface CalculatedStatRowProps {
  label: string
  stat: StatValue
  unit?: string
  format?: StatFormat
}

/**
 * Stat row with calculated value and hover tooltip for breakdown
 */
export function CalculatedStatRow({
  label,
  stat,
  unit = "",
  format = "number",
}: CalculatedStatRowProps) {
  const isModified = stat.modified !== stat.base
  const isIncrease = stat.modified > stat.base
  const hasCap = stat.capped !== undefined
  const hasContributions = stat.contributions.length > 0

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <div
            className={cn(
              "flex items-center justify-between text-xs",
              hasContributions && "cursor-help",
            )}
          />
        }
      >
        <span className="text-muted-foreground">{label}</span>
        <span
          className={cn(
            "font-medium tabular-nums",
            isModified && (isIncrease ? "text-positive" : "text-destructive"),
          )}
        >
          {formatDisplayValue(stat.modified, format)}
          {unit}
          {hasCap && (
            <span className="text-warning ml-1">
              ({formatDisplayValue(stat.capped!, format)}
              {unit} uncapped)
            </span>
          )}
        </span>
      </TooltipTrigger>
      {hasContributions && (
        <TooltipContent side="left" className="max-w-xs">
          <StatBreakdownTooltip stat={stat} format={format} unit={unit} />
        </TooltipContent>
      )}
    </Tooltip>
  )
}

/**
 * Simple stat row for base stats (no calculation, just display)
 */
export function SimpleStatRow({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  )
}
