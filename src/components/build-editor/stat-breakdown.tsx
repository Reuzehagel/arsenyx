"use client";

import { cn } from "@/lib/utils";
import type { StatValue } from "@/lib/warframe/stat-types";
import type { StatFormat } from "./stat-row";

interface StatBreakdownTooltipProps {
  stat: StatValue;
  format: StatFormat;
  unit: string;
}

/**
 * Format a contribution value for tooltip display
 */
function formatContribution(value: number, format: StatFormat): string {
  const sign = value >= 0 ? "+" : "";
  switch (format) {
    case "percent":
      return `${sign}${value.toFixed(1).replace(/\.0$/, "")}%`;
    case "multiplier":
      return `${sign}${value.toFixed(1).replace(/\.0$/, "")}x`;
    case "decimal":
      return `${sign}${value.toFixed(2).replace(/\.?0+$/, "")}`;
    case "number":
    default:
      return `${sign}${Math.round(value)}`;
  }
}

/**
 * Format a percentage value for tooltip display
 */
function formatPercent(value: number): string {
  return `${value.toFixed(1).replace(/\.0$/, "")}%`;
}

/**
 * Tooltip content showing step-by-step calculation breakdown
 */
export function StatBreakdownTooltip({
  stat,
  format,
  unit,
}: StatBreakdownTooltipProps) {
  // Group contributions by source type
  const modContributions = stat.contributions.filter((c) => c.source === "mod");
  const shardContributions = stat.contributions.filter((c) => c.source === "shard");
  const setBonusContributions = stat.contributions.filter((c) => c.source === "set_bonus");
  const auraContributions = stat.contributions.filter((c) => c.source === "aura");

  // Format base value for display
  const formatValue = (value: number): string => {
    switch (format) {
      case "percent":
        return `${value.toFixed(1).replace(/\.0$/, "")}%`;
      case "multiplier":
        return `${value.toFixed(1).replace(/\.0$/, "")}x`;
      case "decimal":
        return value.toFixed(2).replace(/\.?0+$/, "");
      case "number":
      default:
        return Math.round(value).toString();
    }
  };

  return (
    <div className="space-y-1.5 text-xs min-w-[180px]">
      {/* Base value */}
      <div className="font-medium border-b border-border pb-1">
        Base: {formatValue(stat.base)}
        {unit}
      </div>

      {/* Mod contributions */}
      {modContributions.length > 0 && (
        <div className="space-y-0.5">
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
        <div className="space-y-0.5">
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
        <div className="space-y-0.5">
          <span className="text-muted-foreground text-[10px]">Archon Shards</span>
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
        <div className="space-y-0.5">
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
      <div className="font-medium border-t border-border pt-1">
        Final: {formatValue(stat.modified)}
        {unit}
      </div>

      {/* Capped warning */}
      {stat.capped !== undefined && (
        <div className="text-yellow-500 text-[10px]">
          Capped from {formatValue(stat.capped)}
          {unit}
        </div>
      )}
    </div>
  );
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
  name: string;
  value: number;
  percent: number;
  format: StatFormat;
  unit: string;
  highlight?: boolean;
}) {
  return (
    <div className={cn("flex justify-between gap-4", highlight && "text-amber-400")}>
      <span className="text-muted-foreground truncate max-w-[120px]">{name}</span>
      <span className="flex-shrink-0">
        {formatContribution(value, format)}
        {unit}
        <span className="text-muted-foreground ml-1">({formatPercent(percent)})</span>
      </span>
    </div>
  );
}
