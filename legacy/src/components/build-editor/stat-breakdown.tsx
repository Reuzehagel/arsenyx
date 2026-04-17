"use client"

import { cn } from "@/lib/utils"
import {
  formatDisplayValue,
  formatContribution,
  formatPercent,
  type StatFormat,
} from "@/lib/warframe/formatting"
import type { StatValue } from "@/lib/warframe/stat-types"

interface StatBreakdownTooltipProps {
  stat: StatValue
  format: StatFormat
  unit: string
}

/**
 * Tooltip content showing step-by-step calculation breakdown
 */
export function StatBreakdownTooltip({
  stat,
  format,
  unit,
}: StatBreakdownTooltipProps) {
  // Group contributions by source type in a single pass
  const modContributions: typeof stat.contributions = []
  const shardContributions: typeof stat.contributions = []
  const setBonusContributions: typeof stat.contributions = []
  const auraContributions: typeof stat.contributions = []
  for (const c of stat.contributions) {
    switch (c.source) {
      case "mod":
        modContributions.push(c)
        break
      case "shard":
        shardContributions.push(c)
        break
      case "set_bonus":
        setBonusContributions.push(c)
        break
      case "aura":
        auraContributions.push(c)
        break
    }
  }

  // Helper to format values with the current format
  const formatValue = (value: number) => formatDisplayValue(value, format)

  return (
    <div className="flex min-w-[180px] flex-col gap-1.5 text-xs">
      {/* Base value */}
      <div className="border-border border-b pb-1 font-medium">
        Base: {formatValue(stat.base)}
        {unit}
      </div>

      {/* Mod contributions */}
      {modContributions.length > 0 && (
        <div className="flex flex-col gap-0.5">
          {modContributions.map((contrib, i) => (
            <ContributionRow
              key={`mod-${i}`}
              name={contrib.name}
              value={contrib.absoluteValue}
              percent={contrib.percentOfBonus}
              format={format}
              unit={unit}
            />
          ))}
        </div>
      )}

      {/* Set bonus contributions */}
      {setBonusContributions.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-[10px]">Set Bonus</span>
          {setBonusContributions.map((contrib, i) => (
            <ContributionRow
              key={`set-${i}`}
              name={contrib.name}
              value={contrib.absoluteValue}
              percent={contrib.percentOfBonus}
              format={format}
              unit={unit}
              highlight
            />
          ))}
        </div>
      )}

      {/* Shard contributions */}
      {shardContributions.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-[10px]">
            Archon Shards
          </span>
          {shardContributions.map((contrib, i) => (
            <ContributionRow
              key={`shard-${i}`}
              name={contrib.name}
              value={contrib.absoluteValue}
              percent={contrib.percentOfBonus}
              format={format}
              unit={unit}
            />
          ))}
        </div>
      )}

      {/* Aura contributions */}
      {auraContributions.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <span className="text-muted-foreground text-[10px]">Aura</span>
          {auraContributions.map((contrib, i) => (
            <ContributionRow
              key={`aura-${i}`}
              name={contrib.name}
              value={contrib.absoluteValue}
              percent={contrib.percentOfBonus}
              format={format}
              unit={unit}
            />
          ))}
        </div>
      )}

      {/* Final value */}
      <div className="border-border border-t pt-1 font-medium">
        Final: {formatValue(stat.modified)}
        {unit}
      </div>

      {/* Capped warning */}
      {stat.capped !== undefined && (
        <div className="text-warning text-[10px]">
          Capped from {formatValue(stat.capped)}
          {unit}
        </div>
      )}
    </div>
  )
}

/**
 * Single contribution row in the breakdown
 */
function ContributionRow({
  name,
  value,
  percent,
  format,
  unit,
  highlight,
}: {
  name: string
  value: number
  percent: number
  format: StatFormat
  unit: string
  highlight?: boolean
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4",
        highlight && "text-wf-highlight",
      )}
    >
      <span className="text-muted-foreground max-w-[120px] truncate">
        {name}
      </span>
      <span className="flex-shrink-0">
        {formatContribution(value, format)}
        {unit}
        <span className="text-muted-foreground ml-1">
          ({formatPercent(percent)})
        </span>
      </span>
    </div>
  )
}
