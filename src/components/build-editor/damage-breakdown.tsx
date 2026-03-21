"use client";

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { DamageBreakdown, DamageType, ElementalDamage } from "@/lib/warframe/stat-types";

interface DamageBreakdownProps {
  breakdown: DamageBreakdown;
}

// Damage type colors for visual distinction
const DAMAGE_TYPE_COLORS: Record<DamageType, string> = {
  // Physical (IPS)
  impact: "text-blue-400",
  puncture: "text-gray-400",
  slash: "text-red-400",
  // Base elemental
  heat: "text-orange-400",
  cold: "text-cyan-400",
  electricity: "text-blue-300",
  toxin: "text-green-400",
  // Combined elemental
  blast: "text-yellow-500",
  radiation: "text-amber-300",
  gas: "text-lime-300",
  magnetic: "text-purple-400",
  viral: "text-teal-400",
  corrosive: "text-yellow-400",
  // Special
  void: "text-white",
  tau: "text-cyan-300",
};

// Display names for damage types
const DAMAGE_TYPE_NAMES: Record<DamageType, string> = {
  impact: "Impact",
  puncture: "Puncture",
  slash: "Slash",
  heat: "Heat",
  cold: "Cold",
  electricity: "Electricity",
  toxin: "Toxin",
  blast: "Blast",
  radiation: "Radiation",
  gas: "Gas",
  magnetic: "Magnetic",
  viral: "Viral",
  corrosive: "Corrosive",
  void: "Void",
  tau: "Tau",
};

/**
 * Damage breakdown section showing physical and elemental damage types
 */
export function DamageBreakdownSection({ breakdown }: DamageBreakdownProps) {
  const hasPhysical =
    breakdown.physical.impact ||
    breakdown.physical.puncture ||
    breakdown.physical.slash;
  const hasElemental = breakdown.elemental.length > 0;

  if (!hasPhysical && !hasElemental) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Physical damage (IPS) first */}
      {hasPhysical && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Physical
          </span>
          {breakdown.physical.impact && (
            <DamageTypeRow type="impact" value={breakdown.physical.impact} />
          )}
          {breakdown.physical.puncture && (
            <DamageTypeRow type="puncture" value={breakdown.physical.puncture} />
          )}
          {breakdown.physical.slash && (
            <DamageTypeRow type="slash" value={breakdown.physical.slash} />
          )}
        </div>
      )}

      {/* Elemental damage after physical */}
      {hasElemental && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
            Elemental
          </span>
          {breakdown.elemental.map((elem, i) => (
            <ElementalDamageRow key={i} element={elem} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Row for a single damage type
 */
function DamageTypeRow({ type, value }: { type: DamageType; value: number }) {
  return (
    <div className="flex justify-between items-center text-xs">
      <span className={cn("flex items-center gap-1.5", DAMAGE_TYPE_COLORS[type])}>
        <DamageIcon type={type} />
        <span>{DAMAGE_TYPE_NAMES[type]}</span>
      </span>
      <span className="font-medium tabular-nums">{Math.floor(value)}</span>
    </div>
  );
}

/**
 * Row for elemental damage with combination tooltip
 */
function ElementalDamageRow({ element }: { element: ElementalDamage }) {
  const hasSources = element.sources && element.sources.length > 1;

  const content = (
    <div className="flex justify-between items-center text-xs">
      <span className={cn("flex items-center gap-1.5", DAMAGE_TYPE_COLORS[element.type])}>
        <DamageIcon type={element.type} />
        <span>{DAMAGE_TYPE_NAMES[element.type]}</span>
      </span>
      <span className="font-medium tabular-nums">{Math.floor(element.value)}</span>
    </div>
  );

  if (!hasSources) {
    return content;
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<div className="cursor-help" />}>{content}</TooltipTrigger>
      <TooltipContent side="left">
        <div className="text-xs">
          <span className="text-muted-foreground">Combined from: </span>
          <span>{element.sources!.join(" + ")}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Small icon indicator for damage type
 */
function DamageIcon({ type }: { type: DamageType }) {
  // Simple colored dot as a damage type indicator
  return (
    <div
      className={cn("size-2 rounded-full", {
        // Physical
        "bg-blue-400": type === "impact",
        "bg-gray-400": type === "puncture",
        "bg-red-400": type === "slash",
        // Base elemental
        "bg-orange-400": type === "heat",
        "bg-cyan-400": type === "cold",
        "bg-blue-300": type === "electricity",
        "bg-green-400": type === "toxin",
        // Combined elemental
        "bg-yellow-500": type === "blast",
        "bg-amber-300": type === "radiation",
        "bg-lime-300": type === "gas",
        "bg-purple-400": type === "magnetic",
        "bg-teal-400": type === "viral",
        "bg-yellow-400": type === "corrosive",
        // Special
        "bg-white": type === "void",
        "bg-cyan-300": type === "tau",
      })}
    />
  );
}
