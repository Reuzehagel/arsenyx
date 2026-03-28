"use client"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import type {
  DamageBreakdown,
  DamageType,
  ElementalDamage,
} from "@/lib/warframe/stat-types"

interface DamageBreakdownProps {
  breakdown: DamageBreakdown
}

// Damage type colors for visual distinction
const DAMAGE_TYPE_COLORS: Record<DamageType, string> = {
  // Physical (IPS)
  impact: "text-wf-impact",
  puncture: "text-wf-puncture",
  slash: "text-wf-slash",
  // Base elemental
  heat: "text-wf-heat",
  cold: "text-wf-cold",
  electricity: "text-wf-electricity",
  toxin: "text-wf-toxin",
  // Combined elemental
  blast: "text-wf-blast",
  radiation: "text-wf-radiation",
  gas: "text-wf-gas",
  magnetic: "text-wf-magnetic",
  viral: "text-wf-viral",
  corrosive: "text-wf-corrosive",
  // Special
  void: "text-wf-void",
  tau: "text-wf-tau",
}

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
}

/**
 * Damage breakdown section showing physical and elemental damage types
 */
export function DamageBreakdownSection({ breakdown }: DamageBreakdownProps) {
  const hasPhysical =
    breakdown.physical.impact ||
    breakdown.physical.puncture ||
    breakdown.physical.slash
  const hasElemental = breakdown.elemental.length > 0

  if (!hasPhysical && !hasElemental) {
    return null
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Physical damage (IPS) first */}
      {hasPhysical && (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
            Physical
          </span>
          {breakdown.physical.impact && (
            <DamageTypeRow type="impact" value={breakdown.physical.impact} />
          )}
          {breakdown.physical.puncture && (
            <DamageTypeRow
              type="puncture"
              value={breakdown.physical.puncture}
            />
          )}
          {breakdown.physical.slash && (
            <DamageTypeRow type="slash" value={breakdown.physical.slash} />
          )}
        </div>
      )}

      {/* Elemental damage after physical */}
      {hasElemental && (
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-[10px] tracking-wider uppercase">
            Elemental
          </span>
          {breakdown.elemental.map((elem, i) => (
            <ElementalDamageRow key={i} element={elem} />
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Row for a single damage type
 */
function DamageTypeRow({ type, value }: { type: DamageType; value: number }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span
        className={cn("flex items-center gap-1.5", DAMAGE_TYPE_COLORS[type])}
      >
        <DamageIcon type={type} />
        <span>{DAMAGE_TYPE_NAMES[type]}</span>
      </span>
      <span className="font-medium tabular-nums">{Math.floor(value)}</span>
    </div>
  )
}

/**
 * Row for elemental damage with combination tooltip
 */
function ElementalDamageRow({ element }: { element: ElementalDamage }) {
  const hasSources = element.sources && element.sources.length > 1

  const content = (
    <div className="flex items-center justify-between text-xs">
      <span
        className={cn(
          "flex items-center gap-1.5",
          DAMAGE_TYPE_COLORS[element.type],
        )}
      >
        <DamageIcon type={element.type} />
        <span>{DAMAGE_TYPE_NAMES[element.type]}</span>
      </span>
      <span className="font-medium tabular-nums">
        {Math.floor(element.value)}
      </span>
    </div>
  )

  if (!hasSources) {
    return content
  }

  return (
    <Tooltip>
      <TooltipTrigger render={<div className="cursor-help" />}>
        {content}
      </TooltipTrigger>
      <TooltipContent side="left">
        <div className="text-xs">
          <span className="text-muted-foreground">Combined from: </span>
          <span>{element.sources!.join(" + ")}</span>
        </div>
      </TooltipContent>
    </Tooltip>
  )
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
        "bg-wf-impact": type === "impact",
        "bg-wf-puncture": type === "puncture",
        "bg-wf-slash": type === "slash",
        // Base elemental
        "bg-wf-heat": type === "heat",
        "bg-wf-cold": type === "cold",
        "bg-wf-electricity": type === "electricity",
        "bg-wf-toxin": type === "toxin",
        // Combined elemental
        "bg-wf-blast": type === "blast",
        "bg-wf-radiation": type === "radiation",
        "bg-wf-gas": type === "gas",
        "bg-wf-magnetic": type === "magnetic",
        "bg-wf-viral": type === "viral",
        "bg-wf-corrosive": type === "corrosive",
        // Special
        "bg-wf-void": type === "void",
        "bg-wf-tau": type === "tau",
      })}
    />
  )
}
