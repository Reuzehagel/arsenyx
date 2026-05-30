import {
  hasIncarnon,
  INCARNON_FORM_ATTACK_NAME,
} from "@arsenyx/shared/warframe/incarnon-data"
import {
  isKitgunChamber,
  type KitgunComponents,
} from "@arsenyx/shared/warframe/kitgun-data"
import {
  DEFAULT_DEPLOYMENT_CONTEXT,
  type DeploymentContext,
  type Gun,
  type LichBonusElement,
  type Melee,
  type Warframe,
} from "@arsenyx/shared/warframe/types"
import { isZawStrike } from "@arsenyx/shared/warframe/zaw-data"
import { useQuery } from "@tanstack/react-query"
import { ChevronDown, SlidersHorizontal } from "lucide-react"
import { Suspense, useMemo, useState } from "react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Switch } from "@/components/ui/switch"
import { adjustChamberForKitgun } from "@/lib/kitgun-stats"
import { type HelminthAbility } from "@/lib/queries/helminth-query"
import { modularQuery } from "@/lib/queries/modular-query"
import { type PlacedShard } from "@/lib/shards"
import {
  calculateCompanionStats,
  calculateWarframeStats,
  calculateWeaponStats,
  hasConditionalStats,
  type CompanionStats,
  type WarframeStats,
  type WeaponStats,
} from "@/lib/stats"
import { cn } from "@/lib/util/utils"
import { type BrowseCategory, type DetailItem } from "@/lib/warframe"
import { adjustStrikeForZaw } from "@/lib/zaw-stats"

import { AbilityIcon } from "./ability-icon"
import { CapacityBar } from "./capacity-bar"
import { IncarnonTierGrid, IncarnonTierGridSkeleton } from "./incarnon-controls"
import { KitgunComponentSelector } from "./kitgun-component-selector"
import { isLichWeapon } from "./layout"
import { LichBonusElementPicker } from "./lich-bonus-picker"
import { ShardSlot } from "./shard-controls"
import {
  CompanionStatsPanel,
  WarframeStatsPanel,
  WeaponStatsPanel,
} from "./stats-panels"
import type { PlacedArcane } from "./use-arcane-slots"
import type { PlacedMod, SlotId } from "./use-build-slots"
import { ZawComponentSelector } from "./zaw-component-selector"

const SHARD_SLOTS = 5

const DEPLOYMENT_ITEMS: { value: DeploymentContext; label: string }[] = [
  { value: "atmospheric", label: "Atmospheric" },
  { value: "archwing", label: "Archwing" },
]

function itemHasWeaponData(item: DetailItem): boolean {
  if (item.totalDamage !== undefined) return true
  const attacks = (item as { attacks?: unknown[] }).attacks
  return Array.isArray(attacks) && attacks.length > 0
}

export interface ItemSidebarProps {
  item: DetailItem
  category: BrowseCategory
  capacityUsed: number
  capacityMax: number
  autoFormaCount?: number
  /** Transient flag set after a click that couldn't produce a plan. The
   * button flips to a "No fix found" label briefly so the click isn't
   * silently swallowed. */
  autoFormaNoFix?: boolean
  onAutoForma?: () => void
  hasReactor: boolean
  onToggleReactor: () => void
  shards: (PlacedShard | null)[]
  onSetShard: (index: number, shard: PlacedShard | null) => void
  helminth: Record<number, HelminthAbility>
  onSetHelminth: (slotIndex: number, ability: HelminthAbility | null) => void
  zawComponents?: { grip: string; link: string }
  onSetZawComponents?: (components: { grip: string; link: string }) => void
  kitgunComponents?: KitgunComponents
  onSetKitgunComponents?: (components: KitgunComponents) => void
  lichBonusElement?: LichBonusElement | null
  onSetLichBonusElement?: (value: LichBonusElement | null) => void
  incarnonEnabled?: boolean
  onToggleIncarnon?: () => void
  incarnonPerks?: (string | null)[]
  onSetIncarnonPerk?: (tierIndex: number, perkName: string | null) => void
  /**
   * Arch-Gun deployment context. Defaults to `"atmospheric"` when the item
   * has an atmospheric variant; otherwise the toggle is hidden.
   */
  deploymentContext?: DeploymentContext
  onSetDeploymentContext?: (value: DeploymentContext) => void
  placedMods: Partial<Record<SlotId, PlacedMod>>
  placedArcanes: (PlacedArcane | null)[]
  readOnly?: boolean
  /**
   * When true, render without the outer card chrome and without the mobile
   * "Show stats" toggle. Used when ItemSidebar is hosted inside a popover
   * (which provides its own surface and is already an explicit "show stats"
   * action).
   */
  bare?: boolean
}

export function ItemSidebar({
  item,
  category,
  capacityUsed,
  capacityMax,
  autoFormaCount,
  autoFormaNoFix,
  onAutoForma,
  hasReactor,
  onToggleReactor,
  shards,
  onSetShard,
  helminth,
  onSetHelminth,
  zawComponents,
  onSetZawComponents,
  kitgunComponents,
  onSetKitgunComponents,
  lichBonusElement,
  onSetLichBonusElement,
  incarnonEnabled = false,
  onToggleIncarnon,
  incarnonPerks,
  onSetIncarnonPerk,
  deploymentContext,
  onSetDeploymentContext,
  placedMods,
  placedArcanes,
  readOnly = false,
  bare = false,
}: ItemSidebarProps) {
  const isZawItem = category === "melee" && isZawStrike(item.name)
  // Kitgun chambers surface as primary/secondary browse items; the grip's
  // class is fixed by which one the build is anchored to.
  const isKitgunItem =
    (category === "primary" || category === "secondary") &&
    isKitgunChamber(item.uniqueName)
  const kitgunClass = category === "primary" ? "primary" : "secondary"
  // Distinguish archwing *suits* (have health) from arch-guns / arch-melee
  // (have attack data). Both share the `archwing` browse category.
  const hasWeaponData = itemHasWeaponData(item)
  const isArchwingSuit =
    category === "archwing" && !hasWeaponData && item.health !== undefined
  const isWarframe =
    category === "warframes" || category === "necramechs" || isArchwingSuit
  const isPureWarframe = category === "warframes"
  const isCompanion = category === "companions" && !hasWeaponData
  const isWeapon =
    hasWeaponData &&
    (category === "primary" ||
      category === "secondary" ||
      category === "melee" ||
      category === "companion-weapons" ||
      category === "archwing" ||
      category === "exalted-weapons" ||
      category === "companions")
  const showLichBonus = isWeapon && isLichWeapon(item)
  const showShards = category === "warframes"
  const skipRankUpBonus = category === "necramechs" || isArchwingSuit
  const abilities = item.abilities ?? []
  const boosterLabel = isWarframe ? "Reactor" : "Catalyst"

  const showIncarnon = isWeapon && hasIncarnon(item.name)

  // Atmospheric Archguns lose innate elemental damage when deployed on the
  // ground, so the toggle only appears for arch-guns with an explicit
  // atmospheric variant. Non-arch-guns are pinned to "archwing".
  const hasAtmosphericVariant =
    isWeapon &&
    category === "archwing" &&
    item.displayClass === "Archgun" &&
    item.atmosphericDamage !== undefined
  const effectiveDeploymentContext: DeploymentContext = hasAtmosphericVariant
    ? (deploymentContext ?? DEFAULT_DEPLOYMENT_CONTEXT)
    : "archwing"

  const modList = useMemo(
    () =>
      Object.values(placedMods).filter((p): p is PlacedMod => p !== undefined),
    [placedMods],
  )
  const arcaneList = useMemo(
    () => placedArcanes.filter((a): a is PlacedArcane => !!a),
    [placedArcanes],
  )

  // Kitgun chambers ship zero-stat; reconstruct from the selected grip+loader
  // using the wiki-sourced modifier tables. Only fetched for kitgun items.
  const { data: modular } = useQuery({
    ...modularQuery,
    enabled: isKitgunItem,
  })

  const [showMaxStacks, setShowMaxStacks] = useState(false)

  // Stats panels fold on phones only. On sm+ (≥640px) the `sm:flex` rule
  // below forces the panel visible regardless of this state, so we default
  // to collapsed: the toggle button is sm:hidden and only flips this on
  // actual phones.
  const [statsExpanded, setStatsExpanded] = useState(false)
  const hasConditional = useMemo(
    () => hasConditionalStats(modList, arcaneList),
    [modList, arcaneList],
  )

  const warframeStats = useMemo<WarframeStats | null>(() => {
    if (!isWarframe) return null
    return calculateWarframeStats({
      warframe: item as unknown as Warframe,
      mods: modList,
      arcanes: arcaneList,
      shards,
      skipRankUpBonus,
      showMaxStacks,
    })
  }, [
    isWarframe,
    item,
    modList,
    arcaneList,
    shards,
    skipRankUpBonus,
    showMaxStacks,
  ])

  const weaponStats = useMemo<WeaponStats | null>(() => {
    if (!isWeapon) return null
    const baseWeapon = item as unknown as Gun | Melee
    let weapon: Gun | Melee = baseWeapon
    if (isZawItem && zawComponents) {
      weapon = adjustStrikeForZaw(
        baseWeapon,
        item.name,
        zawComponents.grip,
        zawComponents.link,
      )
    } else if (isKitgunItem && kitgunComponents) {
      weapon = adjustChamberForKitgun(
        baseWeapon as Gun,
        item.family ?? "",
        kitgunClass,
        kitgunComponents.grip,
        kitgunComponents.loader,
        modular?.kitgun,
      )
    }
    const stats = calculateWeaponStats({
      weapon,
      mods: modList,
      arcanes: arcaneList,
      showMaxStacks,
      deploymentContext: effectiveDeploymentContext,
      lichBonusElement,
    })
    // The Incarnon Form alt-fire is only available with the adapter installed.
    if (showIncarnon && !incarnonEnabled) {
      return {
        ...stats,
        attackModes: stats.attackModes.filter(
          (m) => m.name !== INCARNON_FORM_ATTACK_NAME,
        ),
      }
    }
    return stats
  }, [
    isWeapon,
    isZawItem,
    zawComponents,
    isKitgunItem,
    kitgunComponents,
    kitgunClass,
    modular,
    item,
    modList,
    arcaneList,
    showMaxStacks,
    showIncarnon,
    incarnonEnabled,
    effectiveDeploymentContext,
    lichBonusElement,
  ])

  const companionStats = useMemo<CompanionStats | null>(() => {
    if (!isCompanion) return null
    return calculateCompanionStats({
      companion: {
        name: item.name,
        health: item.health,
        shield: item.shield,
        armor: item.armor,
        power: item.power,
      },
      mods: modList,
      arcanes: arcaneList,
      showMaxStacks,
    })
  }, [isCompanion, item, modList, arcaneList, showMaxStacks])

  return (
    <>
      <div
        className={cn(
          "flex flex-col",
          bare
            ? "min-w-0"
            : "bg-card h-full rounded-lg border xl:overflow-y-auto",
        )}
      >
        {isWarframe && abilities.length > 0 && (
          <>
            <div className="flex justify-around p-3">
              {abilities.slice(0, 4).map((a, i) => {
                const replaced = helminth[i]
                const displayed = replaced
                  ? {
                      uniqueName: replaced.uniqueName,
                      name: replaced.name,
                      description: replaced.description,
                      imageName: replaced.imageName,
                    }
                  : a
                return (
                  <AbilityIcon
                    key={i}
                    ability={displayed}
                    isHelminth={Boolean(replaced)}
                    canSubsume={isPureWarframe && !readOnly}
                    onSelectHelminth={(ab) => onSetHelminth(i, ab)}
                  />
                )
              })}
            </div>
            <Separator />
          </>
        )}

        {isZawItem && zawComponents && (
          <>
            <div className="flex justify-center p-3">
              <ZawComponentSelector
                components={zawComponents}
                onChange={onSetZawComponents}
                readOnly={readOnly}
              />
            </div>
            <Separator />
          </>
        )}

        {isKitgunItem && kitgunComponents && (
          <>
            <div className="flex justify-center p-3">
              <KitgunComponentSelector
                components={kitgunComponents}
                cls={kitgunClass}
                onChange={onSetKitgunComponents}
                readOnly={readOnly}
              />
            </div>
            <Separator />
          </>
        )}

        {showShards && (
          <>
            <div className="flex justify-around p-3">
              {Array.from({ length: SHARD_SLOTS }).map((_, i) => (
                <ShardSlot
                  key={i}
                  shard={shards[i] ?? null}
                  onPick={(s) => onSetShard(i, s)}
                  readOnly={readOnly}
                />
              ))}
            </div>
            <Separator />
          </>
        )}

        {showIncarnon && (
          <>
            <div className="flex flex-col gap-2 p-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Incarnon</span>
                <Switch
                  size="sm"
                  checked={incarnonEnabled}
                  onCheckedChange={onToggleIncarnon}
                  disabled={readOnly}
                />
              </div>
              {incarnonEnabled && (
                <Suspense fallback={<IncarnonTierGridSkeleton />}>
                  <IncarnonTierGrid
                    weaponName={item.name}
                    perks={incarnonPerks ?? []}
                    onPick={(tierIndex, perk) =>
                      onSetIncarnonPerk?.(tierIndex, perk)
                    }
                    readOnly={readOnly}
                  />
                </Suspense>
              )}
            </div>
            <Separator />
          </>
        )}

        <div className="flex flex-col gap-2 p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium">{boosterLabel}</span>
            <Switch
              size="sm"
              checked={hasReactor}
              onCheckedChange={onToggleReactor}
              disabled={readOnly}
            />
          </div>

          <CapacityBar
            used={capacityUsed}
            max={capacityMax}
            autoFormaCount={autoFormaCount}
            autoFormaNoFix={autoFormaNoFix}
            onAutoForma={onAutoForma}
          />
        </div>

        {/* `sm:flex` is unconditional so desktop visibility never depends on
            `statsExpanded` — the toggle that flips it is `sm:hidden`. */}
        <div
          className={cn("flex-col sm:flex", statsExpanded ? "flex" : "hidden")}
        >
          <Separator />
          <div className="flex flex-col gap-3 p-3">
            {hasConditional && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Max stacks</span>
                <Switch
                  size="sm"
                  checked={showMaxStacks}
                  onCheckedChange={setShowMaxStacks}
                />
              </div>
            )}
            {hasAtmosphericVariant && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Deployment</span>
                <Select
                  items={DEPLOYMENT_ITEMS}
                  value={effectiveDeploymentContext}
                  onValueChange={(v) =>
                    onSetDeploymentContext?.(v as DeploymentContext)
                  }
                  disabled={readOnly}
                >
                  <SelectTrigger size="sm" className="h-7 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {DEPLOYMENT_ITEMS.map((it) => (
                        <SelectItem key={it.value} value={it.value}>
                          {it.label}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </div>
            )}
            {showLichBonus && (
              <LichBonusElementPicker
                value={lichBonusElement ?? null}
                onChange={(v) => onSetLichBonusElement?.(v)}
                readOnly={readOnly}
              />
            )}
            {warframeStats && <WarframeStatsPanel stats={warframeStats} />}
            {weaponStats && <WeaponStatsPanel stats={weaponStats} />}
            {companionStats && <CompanionStatsPanel stats={companionStats} />}
          </div>
        </div>
      </div>
      {!bare && (
        <button
          type="button"
          onClick={() => setStatsExpanded((v) => !v)}
          className="bg-card text-muted-foreground hover:bg-accent/40 hover:text-foreground mx-auto flex items-center gap-1.5 rounded-t-none rounded-b-md border border-t-0 px-3 py-1 text-xs transition-colors sm:hidden"
        >
          <span>{statsExpanded ? "Hide stats" : "Show stats"}</span>
          <ChevronDown
            className={cn(
              "size-3.5 transition-transform",
              statsExpanded && "rotate-180",
            )}
          />
        </button>
      )}
    </>
  )
}

/**
 * Trigger + popover wrapper used at intermediate widths (sm to xl) where the
 * stacked sidebar would leave awkward horizontal whitespace. Renders a small
 * "Stats" button that opens the full ItemSidebar contents in a popover.
 */
export function ItemSidebarPopover({
  className,
  ...sidebarProps
}: ItemSidebarProps & { className?: string }) {
  return (
    <Popover>
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "text-muted-foreground hover:bg-accent/40 hover:text-foreground inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition-colors",
              className,
            )}
          >
            <SlidersHorizontal className="size-4" />
            <span>Stats</span>
          </button>
        }
      />
      <PopoverContent
        side="bottom"
        align="start"
        className="max-h-[85vh] w-[280px] overflow-y-auto p-3"
      >
        <ItemSidebar {...sidebarProps} bare />
      </PopoverContent>
    </Popover>
  )
}
