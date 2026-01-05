"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { StatValue } from "@/lib/warframe/stat-types";
import { formatDisplayValue, type StatFormat } from "@/lib/warframe/formatting";
import { StatBreakdownTooltip } from "./stat-breakdown";

// Re-export StatFormat for backwards compatibility
export type { StatFormat };

interface CalculatedStatRowProps {
  label: string;
  stat: StatValue;
  unit?: string;
  format?: StatFormat;
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
            {formatDisplayValue(stat.modified, format)}
            {unit}
            {hasCap && (
              <span className="text-yellow-500 ml-1">
                ({formatDisplayValue(stat.capped!, format)}
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
