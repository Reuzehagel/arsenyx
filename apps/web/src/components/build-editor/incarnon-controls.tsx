import {
  getIncarnonBaseName,
  type IncarnonEvolution,
} from "@arsenyx/shared/warframe/incarnon-data"
import { useSuspenseQuery } from "@tanstack/react-query"
import { X } from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { incarnonEvolutionsQuery } from "@/lib/queries/incarnon-query"
import { cn } from "@/lib/util/utils"

export function IncarnonTierGridSkeleton() {
  return (
    <div className="flex flex-wrap justify-around gap-1.5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="border-muted-foreground/10 size-10 animate-pulse rounded-sm border border-dashed"
        />
      ))}
    </div>
  )
}

export function IncarnonTierGrid({
  weaponName,
  perks,
  onPick,
  readOnly,
}: {
  weaponName: string
  perks: (string | null)[]
  onPick: (tierIndex: number, perk: string | null) => void
  readOnly: boolean
}) {
  const { data: evolutions } = useSuspenseQuery(incarnonEvolutionsQuery)
  const baseName = getIncarnonBaseName(weaponName)
  const evolution: IncarnonEvolution | undefined = baseName
    ? evolutions[baseName]
    : undefined
  if (!evolution) return null
  // Tier 1 is the unlock — no choice. Render only tiers with >1 perk option.
  const choosableTiers = evolution.tiers.filter((t) => t.perks.length > 1)
  return (
    <div className="flex flex-wrap justify-around gap-1.5">
      {choosableTiers.map((tier) => {
        const tierIndex = tier.tier - 1
        const picked = perks[tierIndex] ?? null
        const pickedPerk = tier.perks.find((p) => p.name === picked) ?? null
        return (
          <IncarnonTierSlot
            key={tier.tier}
            tier={tier.tier}
            perks={tier.perks}
            picked={pickedPerk}
            onPick={(perk) => onPick(tierIndex, perk?.name ?? null)}
            readOnly={readOnly}
          />
        )
      })}
    </div>
  )
}

function IncarnonTierSlot({
  tier,
  perks,
  picked,
  onPick,
  readOnly,
}: {
  tier: number
  perks: { name: string; description: string }[]
  picked: { name: string; description: string } | null
  onPick: (perk: { name: string; description: string } | null) => void
  readOnly: boolean
}) {
  const [open, setOpen] = useState(false)
  const triggerButton = (
    <button
      type="button"
      className={cn(
        "relative flex size-10 items-center justify-center rounded-sm border text-xs font-semibold tabular-nums transition-colors",
        picked
          ? "bg-muted/40 border-border text-foreground hover:border-muted-foreground/60"
          : "border-muted-foreground/10 hover:border-muted-foreground/25 text-muted-foreground/40 border-dashed",
      )}
    >
      T{tier}
    </button>
  )

  return (
    <Popover open={open} onOpenChange={readOnly ? undefined : setOpen}>
      <Tooltip>
        <TooltipTrigger
          render={
            readOnly ? triggerButton : <PopoverTrigger render={triggerButton} />
          }
        />
        <TooltipContent side="bottom" className="max-w-xs">
          {picked ? (
            <>
              <p className="font-semibold">{picked.name}</p>
              <p className="text-muted-foreground mt-0.5">
                {picked.description}
              </p>
            </>
          ) : (
            <span className="text-muted-foreground">
              Tier {tier} — select a perk
            </span>
          )}
        </TooltipContent>
      </Tooltip>
      {!readOnly && (
        <PopoverContent side="right" align="start" className="w-72">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium">Tier {tier}</span>
              {picked && (
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => {
                    onPick(null)
                    setOpen(false)
                  }}
                  title="Clear selection"
                  aria-label="Clear selection"
                >
                  <X className="size-3" />
                </Button>
              )}
            </div>
            <div className="flex flex-col gap-0.5">
              {perks.map((perk) => {
                const isActive = picked?.name === perk.name
                return (
                  <button
                    key={perk.name}
                    type="button"
                    onClick={() => {
                      onPick(perk)
                      setOpen(false)
                    }}
                    className={cn(
                      "hover:bg-muted flex flex-col items-start gap-0.5 rounded px-1.5 py-1 text-left text-xs transition-colors",
                      isActive && "bg-muted",
                    )}
                  >
                    <span className="font-medium">{perk.name}</span>
                    <span className="text-muted-foreground text-[10px] leading-snug">
                      {perk.description}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        </PopoverContent>
      )}
    </Popover>
  )
}
