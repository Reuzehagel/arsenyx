import { getIncarnonBaseName } from "@arsenyx/shared/warframe/incarnon-data"
import type { LichBonusElement } from "@arsenyx/shared/warframe/types"
import {
  getZawComponentImage,
  isZawStrike,
} from "@arsenyx/shared/warframe/zaw-data"
import { useSuspenseQuery } from "@tanstack/react-query"
import { ExternalLink, Zap } from "lucide-react"
import { Suspense, useState } from "react"

import { ShardSlot } from "@/components/build-editor/shard-controls"
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
import type { HelminthAbility } from "@/lib/queries/helminth-query"
import { incarnonEvolutionsQuery } from "@/lib/queries/incarnon-query"
import type { PlacedShard } from "@/lib/shards"
import { cn } from "@/lib/util/utils"
import { getImageUrl } from "@/lib/warframe"

/**
 * Render-router for the per-category strips shown above the loadout in
 * `?embed=1` mode. Keeps the route file out of the conditional spaghetti
 * by accepting everything as plain props and short-circuiting internally.
 */
export function EmbedStrips({
  category,
  itemName,
  itemImageName,
  abilities,
  helminth,
  shards,
  zawComponents,
  incarnonEnabled,
  incarnonPerks,
  lichBonusElement,
  slug,
}: {
  category: string
  itemName: string
  itemImageName?: string
  abilities: Array<{ name: string; description: string; imageName?: string }>
  helminth: Record<number, HelminthAbility>
  shards: (PlacedShard | null)[]
  zawComponents: { grip: string; link: string } | undefined
  incarnonEnabled: boolean
  incarnonPerks: (string | null)[]
  lichBonusElement: LichBonusElement | null
  slug: string
}) {
  return (
    <>
      {category === "warframes" && (
        <EmbedWarframeStrip
          abilities={abilities}
          helminth={helminth}
          shards={shards}
          slug={slug}
          itemName={itemName}
          itemImageName={itemImageName}
        />
      )}
      {category === "melee" && isZawStrike(itemName) && zawComponents && (
        <EmbedZawStrip
          itemName={itemName}
          itemImageName={itemImageName}
          grip={zawComponents.grip}
          link={zawComponents.link}
          slug={slug}
        />
      )}
      {incarnonEnabled && incarnonPerks.some(Boolean) && (
        <Suspense fallback={null}>
          <EmbedIncarnonStrip
            weaponName={itemName}
            itemImageName={itemImageName}
            perks={incarnonPerks}
            slug={slug}
          />
        </Suspense>
      )}
      {lichBonusElement !== null && (
        <EmbedLichStrip
          element={lichBonusElement}
          itemName={itemName}
          itemImageName={itemImageName}
          slug={slug}
        />
      )}
    </>
  )
}

function EmbedWarframeStrip({
  abilities,
  helminth,
  shards,
  slug,
  itemName,
  itemImageName,
}: {
  abilities: Array<{ name: string; description: string; imageName?: string }>
  helminth: Record<number, HelminthAbility>
  shards: (PlacedShard | null)[]
  slug: string
  itemName: string
  itemImageName?: string
}) {
  const buildUrl = `${window.location.origin}/builds/${slug}`
  const hasAbilities = abilities.length > 0
  const hasShards = shards.some(Boolean)
  if (!hasAbilities && !hasShards) return null

  return (
    <div className="bg-card flex flex-col items-center gap-3 rounded-lg border p-3 md:flex-row">
      <div className="flex shrink-0 items-center gap-2">
        <div className="bg-muted/10 relative flex size-8 shrink-0 overflow-hidden rounded">
          <img
            src={getImageUrl(itemImageName)}
            alt={itemName}
            className="h-full w-full object-cover"
          />
        </div>
        <span className="max-w-[120px] truncate text-sm font-semibold">
          {itemName}
        </span>
      </div>
      <div className="flex w-full flex-wrap items-center justify-center gap-x-3 gap-y-2 md:w-auto md:flex-1">
        {hasAbilities && (
          <div className="flex shrink-0 items-center gap-1.5">
            {abilities.slice(0, 4).map((a, i) => {
              const replaced = helminth[i]
              const displayed = replaced
                ? {
                    name: replaced.name,
                    description: replaced.description,
                    imageName: replaced.imageName,
                  }
                : a
              return (
                <EmbedAbilityIcon
                  key={i}
                  ability={displayed}
                  isHelminth={Boolean(replaced)}
                />
              )
            })}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-1.5">
          {shards.slice(0, 5).map((shard, i) => (
            <ShardSlot key={i} shard={shard} onPick={() => {}} readOnly />
          ))}
        </div>
      </div>
      <a
        href={buildUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-muted-foreground hover:bg-accent/40 hover:text-foreground inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors"
      >
        View on Arsenyx
        <ExternalLink className="size-3" />
      </a>
    </div>
  )
}

function EmbedAbilityIcon({
  ability,
  isHelminth,
}: {
  ability: { name: string; description: string; imageName?: string }
  isHelminth: boolean
}) {
  const [open, setOpen] = useState(false)
  const triggerEl = (
    <button
      type="button"
      className={cn(
        "bg-muted relative size-10 overflow-hidden rounded-sm border",
        isHelminth ? "border-destructive/60" : "border-border",
      )}
    >
      {ability.imageName ? (
        <img
          src={getImageUrl(ability.imageName)}
          alt={ability.name}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="text-muted-foreground flex h-full w-full items-center justify-center">
          <Zap className="size-4" />
        </div>
      )}
    </button>
  )
  const tooltipContent = (
    <>
      <p className="font-semibold">
        {ability.name}
        {isHelminth && (
          <span className="text-destructive ml-1 text-[10px]">(Helminth)</span>
        )}
      </p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {ability.description}
      </p>
    </>
  )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger render={<PopoverTrigger render={triggerEl} />} />
        <TooltipContent side="bottom" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
      <PopoverContent side="bottom" align="center" className="max-w-xs p-3">
        {tooltipContent}
      </PopoverContent>
    </Popover>
  )
}

// ─── Zaw strip ───────────────────────────────────────────────────────────────

function EmbedZawStrip({
  itemName,
  itemImageName,
  grip,
  link,
  slug,
}: {
  itemName: string
  itemImageName?: string
  grip: string
  link: string
  slug: string
}) {
  const buildUrl = `${window.location.origin}/builds/${slug}`
  return (
    <div className="bg-card flex flex-col items-center gap-3 rounded-lg border p-3 md:flex-row">
      <div className="flex items-center gap-2 md:flex-1">
        <div className="bg-muted/10 relative flex size-8 shrink-0 overflow-hidden rounded">
          <img
            src={getImageUrl(itemImageName)}
            alt={itemName}
            className="h-full w-full object-cover"
          />
        </div>
        <span className="max-w-[120px] truncate text-sm font-semibold">
          {itemName}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        <EmbedZawPart name={grip} type="Grip" />
        <EmbedZawPart name={link} type="Link" />
      </div>
      <div className="flex md:flex-1 md:justify-end">
        <a
          href={buildUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:bg-accent/40 hover:text-foreground inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors"
        >
          View on Arsenyx
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  )
}

function EmbedZawPart({ name, type }: { name: string; type: "Grip" | "Link" }) {
  const [open, setOpen] = useState(false)
  const imageName = getZawComponentImage(name)
  const triggerEl = (
    <button
      type="button"
      className="bg-muted relative flex size-10 items-center justify-center overflow-hidden rounded-sm border"
    >
      {imageName ? (
        <img
          src={getImageUrl(imageName)}
          alt={name}
          className="h-full w-full object-contain"
        />
      ) : (
        <span className="text-muted-foreground px-0.5 text-center text-[9px] leading-tight font-medium">
          {name}
        </span>
      )}
    </button>
  )
  const content = (
    <>
      <p className="font-semibold">{name}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">{type}</p>
    </>
  )
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger render={<PopoverTrigger render={triggerEl} />} />
        <TooltipContent side="bottom">{content}</TooltipContent>
      </Tooltip>
      <PopoverContent side="bottom" align="center" className="p-3">
        {content}
      </PopoverContent>
    </Popover>
  )
}

// ─── Incarnon evo strip ─────────────────────────────────────────────────────

function EmbedIncarnonStrip({
  weaponName,
  itemImageName,
  perks,
  slug,
}: {
  weaponName: string
  itemImageName?: string
  perks: (string | null)[]
  slug: string
}) {
  const { data: evolutions } = useSuspenseQuery(incarnonEvolutionsQuery)
  const baseName = getIncarnonBaseName(weaponName)
  const evolution = baseName ? evolutions[baseName] : undefined
  if (!evolution) return null
  const choosableTiers = evolution.tiers.filter((t) => t.perks.length > 1)
  if (choosableTiers.length === 0) return null

  const buildUrl = `${window.location.origin}/builds/${slug}`
  return (
    <div className="bg-card flex flex-col items-center gap-3 rounded-lg border p-3 md:flex-row">
      <div className="flex items-center gap-2 md:flex-1">
        <div className="bg-muted/10 relative flex size-8 shrink-0 overflow-hidden rounded">
          <img
            src={getImageUrl(itemImageName)}
            alt={weaponName}
            className="h-full w-full object-cover"
          />
        </div>
        <span className="max-w-[120px] truncate text-sm font-semibold">
          {weaponName}
        </span>
      </div>
      <div className="flex items-center gap-1.5">
        {choosableTiers.map((tier) => {
          const picked =
            tier.perks.find((p) => p.name === (perks[tier.tier - 1] ?? null)) ??
            null
          return (
            <EmbedIncarnonTier
              key={tier.tier}
              tier={tier.tier}
              picked={picked}
            />
          )
        })}
      </div>
      <div className="flex md:flex-1 md:justify-end">
        <a
          href={buildUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:bg-accent/40 hover:text-foreground inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors"
        >
          View on Arsenyx
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  )
}

function EmbedIncarnonTier({
  tier,
  picked,
}: {
  tier: number
  picked: { name: string; description: string } | null
}) {
  const [open, setOpen] = useState(false)
  const triggerEl = (
    <button
      type="button"
      className={cn(
        "relative flex size-10 items-center justify-center rounded-sm border text-xs font-semibold tabular-nums",
        picked
          ? "bg-muted/40 border-border text-foreground"
          : "border-muted-foreground/10 text-muted-foreground/40 border-dashed",
      )}
    >
      T{tier}
    </button>
  )
  const tooltipContent = picked ? (
    <>
      <p className="font-semibold">{picked.name}</p>
      <p className="text-muted-foreground mt-0.5 text-xs">
        {picked.description}
      </p>
    </>
  ) : (
    <span className="text-muted-foreground">Tier {tier} — not selected</span>
  )
  return (
    <Popover open={open} onOpenChange={picked ? setOpen : undefined}>
      <Tooltip>
        <TooltipTrigger
          render={picked ? <PopoverTrigger render={triggerEl} /> : triggerEl}
        />
        <TooltipContent side="bottom" className="max-w-xs">
          {tooltipContent}
        </TooltipContent>
      </Tooltip>
      {picked && (
        <PopoverContent side="bottom" align="center" className="max-w-xs p-3">
          {tooltipContent}
        </PopoverContent>
      )}
    </Popover>
  )
}

// ─── Lich element strip ─────────────────────────────────────────────────────

const LICH_ELEMENT_ICON: Record<string, string> = {
  Heat: "/icons/damage/HeatSymbol.png",
  Cold: "/icons/damage/ColdSymbol.png",
  Electricity: "/icons/damage/ElectricitySymbol.png",
  Toxin: "/icons/damage/ToxinSymbol.png",
  Radiation: "/icons/damage/RadiationSymbol.png",
  Magnetic: "/icons/damage/MagneticSymbol.png",
  Impact: "/icons/damage/ImpactSymbol.png",
}

function EmbedLichStrip({
  element,
  itemName,
  itemImageName,
  slug,
}: {
  element: LichBonusElement
  itemName: string
  itemImageName?: string
  slug: string
}) {
  const buildUrl = `${window.location.origin}/builds/${slug}`
  const iconPath = LICH_ELEMENT_ICON[element]
  return (
    <div className="bg-card flex flex-col items-center gap-3 rounded-lg border p-3 md:flex-row">
      <div className="flex items-center gap-2 md:flex-1">
        <div className="bg-muted/10 relative flex size-8 shrink-0 overflow-hidden rounded">
          <img
            src={getImageUrl(itemImageName)}
            alt={itemName}
            className="h-full w-full object-cover"
          />
        </div>
        <span className="max-w-[120px] truncate text-sm font-semibold">
          {itemName}
        </span>
      </div>
      <div className="flex items-center gap-2">
        {iconPath && (
          <img src={iconPath} alt="" aria-hidden className="size-5 shrink-0" />
        )}
        <span className="text-sm font-medium">+60% {element}</span>
      </div>
      <div className="flex md:flex-1 md:justify-end">
        <a
          href={buildUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:bg-accent/40 hover:text-foreground inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors"
        >
          View on Arsenyx
          <ExternalLink className="size-3" />
        </a>
      </div>
    </div>
  )
}
