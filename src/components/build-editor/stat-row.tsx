"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { StatValue } from "@/lib/warframe/stat-types";
import { StatBreakdownTooltip } from "./stat-breakdown";

export type StatFormat = "number" | "percent" | "decimal" | "multiplier";

interface CalculatedStatRowProps {
  label: string;
  stat: StatValue;
  unit?: string;
  format?: StatFormat;
}

/**
 * Format a stat value for display with smart rounding
 */
function formatValue(value: number, format: StatFormat): string {
  switch (format) {
    case "percent":
      // Show as percentage, no trailing zeros
      return value.toFixed(1).replace(/\.0$/, "") + "%";
    case "multiplier":
      // Show with x suffix
      return value.toFixed(1).replace(/\.0$/, "") + "x";
    case "decimal":
      // Show with 2 decimal places, no trailing zeros
      return value.toFixed(2).replace(/\.?0+$/, "");
    case "number":
    default:
      // Floor to integer for most stats (Warframe floors stat values)
      return Math.floor(value).toString();
  }
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
  const isModified = stat.modified !== stat.base;
  const isIncrease = stat.modified > stat.base;
  const hasCap = stat.capped !== undefined;
  const hasContributions = stat.contributions.length > 0;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          className={cn(
            "flex justify-between items-center text-xs",
            hasContributions && "cursor-help"
          )}
        >
          <span className="text-muted-foreground">{label}</span>
          <span
            className={cn(
              "font-medium tabular-nums",
              isModified && (isIncrease ? "text-green-500" : "text-red-500")
            )}
          >
            {formatValue(stat.modified, format)}
            {unit}
            {hasCap && (
              <span className="text-yellow-500 ml-1">
                ({formatValue(stat.capped!, format)}
                {unit} uncapped)
              </span>
            )}
          </span>
        </div>
      </TooltipTrigger>
      {hasContributions && (
        <TooltipContent side="left" className="max-w-xs">
          <StatBreakdownTooltip stat={stat} format={format} unit={unit} />
        </TooltipContent>
      )}
    </Tooltip>
  );
}

/**
 * Simple stat row for base stats (no calculation, just display)
 */
export function SimpleStatRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
