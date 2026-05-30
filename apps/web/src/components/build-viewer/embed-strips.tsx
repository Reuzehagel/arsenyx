import { getIncarnonBaseName } from "@arsenyx/shared/warframe/incarnon-data"
import type { LichBonusElement } from "@arsenyx/shared/warframe/types"
import { isZawStrike } from "@arsenyx/shared/warframe/zaw-data"
import { useQuery, useSuspenseQuery } from "@tanstack/react-query"
import { ExternalLink, Zap } from "lucide-react"
import { type ReactNode, Suspense, useState } from "react"

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
import { kitgunImagesQuery } from "@/lib/queries/kitgun-images-query"
import { zawImagesQuery } from "@/lib/queries/zaw-images-query"
import type { PlacedShard } from "@/lib/shards"
import { DAMAGE_TYPE_ICON, type DamageType } from "@/lib/stats/types"
import { cn } from "@/lib/util/utils"
import { getImageUrl } from "@/lib/warframe"

/**
 * Picks which embed strip(s) to render above the loadout for the given
 * category and build state in `?embed=1` mode.
 */
export function EmbedStrips({
  category,
  itemName,
  itemImageName,
  abilities,
  helminth,
  shards,
  zawComponents,
  kitgunComponents,
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
  kitgunComponents: { grip: string; loader: string } | undefined
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
      {(category === "primary" || category === "secondary") &&
        kitgunComponents && (
          <EmbedKitgunStrip
            itemName={itemName}
            itemImageName={itemImageName}
            grip={kitgunComponents.grip}
            loader={kitgunComponents.loader}
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

/**
 * Shared chrome for the embed strips: card container, item icon + name header,
 * and the "View on Arsenyx" footer link. Each strip supplies only its middle
 * content via `children`. The Warframe strip lays out slightly differently
 * (header and footer don't flex-grow), toggled via `warframeLayout`.
 */
function EmbedStripFrame({
  itemName,
  itemImageName,
  slug,
  warframeLayout = false,
  children,
}: {
  itemName: string
  itemImageName?: string
  slug: string
  warframeLayout?: boolean
  children: ReactNode
}) {
  const buildUrl = `${window.location.origin}/builds/${slug}`
  const footerLink = (
    <a
      href={buildUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="text-muted-foreground hover:bg-accent/40 hover:text-foreground inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition-colors"
    >
      View on Arsenyx
      <ExternalLink className="size-3" />
    </a>
  )
  return (
    <div className="bg-card flex flex-col items-center gap-3 rounded-lg border p-3 md:flex-row">
      <div
        className={cn(
          "flex items-center gap-2",
          warframeLayout ? "shrink-0" : "md:flex-1",
        )}
      >
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
      {children}
      {warframeLayout ? (
        footerLink
      ) : (
        <div className="flex md:flex-1 md:justify-end">{footerLink}</div>
      )}
    </div>
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
  const hasAbilities = abilities.length > 0
  const hasShards = shards.some(Boolean)
  if (!hasAbilities && !hasShards) return null

  return (
    <EmbedStripFrame
      itemName={itemName}
      itemImageName={itemImageName}
      slug={slug}
      warframeLayout
    >
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
    </EmbedStripFrame>
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
  return (
    <EmbedStripFrame
      itemName={itemName}
      itemImageName={itemImageName}
      slug={slug}
    >
      <div className="flex items-center gap-1.5">
        <EmbedZawPart name={grip} type="Grip" />
        <EmbedZawPart name={link} type="Link" />
      </div>
    </EmbedStripFrame>
  )
}

function EmbedZawPart({ name, type }: { name: string; type: "Grip" | "Link" }) {
  const [open, setOpen] = useState(false)
  const { data: zawImages } = useQuery(zawImagesQuery)
  const imageName = zawImages?.[name]
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

// ─── Kitgun strip ───────────────────────────────────────────────────────────

function EmbedKitgunStrip({
  itemName,
  itemImageName,
  grip,
  loader,
  slug,
}: {
  itemName: string
  itemImageName?: string
  grip: string
  loader: string
  slug: string
}) {
  return (
    <EmbedStripFrame
      itemName={itemName}
      itemImageName={itemImageName}
      slug={slug}
    >
      <div className="flex items-center gap-1.5">
        <EmbedKitgunPart name={grip} type="Grip" />
        <EmbedKitgunPart name={loader} type="Loader" />
      </div>
    </EmbedStripFrame>
  )
}

function EmbedKitgunPart({
  name,
  type,
}: {
  name: string
  type: "Grip" | "Loader"
}) {
  const [open, setOpen] = useState(false)
  const { data: kitgunImages } = useQuery(kitgunImagesQuery)
  const imageName = kitgunImages?.[name]
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

  return (
    <EmbedStripFrame
      itemName={weaponName}
      itemImageName={itemImageName}
      slug={slug}
    >
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
    </EmbedStripFrame>
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
  const iconPath = DAMAGE_TYPE_ICON[element.toLowerCase() as DamageType]
  return (
    <EmbedStripFrame
      itemName={itemName}
      itemImageName={itemImageName}
      slug={slug}
    >
      <div className="flex items-center gap-2">
        {iconPath && (
          <img src={iconPath} alt="" aria-hidden className="size-5 shrink-0" />
        )}
        <span className="text-sm font-medium">+60% {element}</span>
      </div>
    </EmbedStripFrame>
  )
}
