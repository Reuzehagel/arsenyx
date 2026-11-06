import type {
  PlacedArcane,
  PlacedMod,
  SlotId,
} from "@arsenyx/shared/warframe/build-data"
import {
  findIncarnonEvolution,
  hasIncarnon,
  isIncarnonFormAttack,
} from "@arsenyx/shared/warframe/incarnon-data"
import { isKitgunChamber } from "@arsenyx/shared/warframe/kitgun-data"
import {
  AMP_BRACES,
  AMP_PRISMS,
  AMP_SCAFFOLDS,
  DEFAULT_OPERATOR_AMP,
  FOCUS_SCHOOLS,
  isModularAmp,
  OPERATOR_AMP_TYPES,
} from "@arsenyx/shared/warframe/operator-loadout"
import { hasModCapacity } from "@arsenyx/shared/warframe/slot-layout"
import type {
  DeploymentContext,
  Gun,
  Melee,
  BrowseCategory,
  Ability,
} from "@arsenyx/shared/warframe/types"
import { isZawItem as isZawStrikeItem } from "@arsenyx/shared/warframe/zaw-data"
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
import {
  type ExtrasState,
  kitgunClass,
  withHelminth,
  withIncarnonPerk,
  withShard,
} from "@/lib/build/extras"
import { isLichWeapon } from "@/lib/build/layout"
import type { DetailItem } from "@/lib/catalog"
import { incarnonEvolutionsQuery } from "@/lib/queries/incarnon-query"
import { modularQuery } from "@/lib/queries/modular-query"
import { SHARD_SLOT_COUNT } from "@/lib/shards"
import {
  calculateCompanionStats,
  calculateWeaponStats,
  hasConditionalStats,
  incarnonPerkStats,
  type CompanionStats,
  type WeaponStats,
} from "@/lib/stats"
import { adjustChamberForKitgun, adjustStrikeForZaw } from "@/lib/stats/modular"
import { cn } from "@/lib/util/utils"

import { AbilityIcon } from "./ability-icon"
import { CapacityBar } from "./capacity-bar"
import { IncarnonTierGrid, IncarnonTierGridSkeleton } from "./incarnon-controls"
import { KitgunComponentSelector } from "./kitgun-component-selector"
import { LichBonusElementPicker } from "./lich-bonus-picker"
import { ShardSlot } from "./shard-controls"
import {
  CompanionStatsPanel,
  WarframeStatsPanel,
  WeaponStatsPanel,
} from "./stats-panels"
import { itemHasWeaponData, useLoadoutStats } from "./use-loadout-stats"
import { ZawComponentSelector } from "./zaw-component-selector"

const DEPLOYMENT_ITEMS: { value: DeploymentContext; label: string }[] = [
  { value: "atmospheric", label: "Atmospheric" },
  { value: "archwing", label: "Archwing" },
]

/** Modular Amp parts in shorthand order (`prism-scaffold-brace`). */
const AMP_PARTS = [
  { label: "Prism", options: AMP_PRISMS },
  { label: "Scaffold", options: AMP_SCAFFOLDS },
  { label: "Brace", options: AMP_BRACES },
]

interface ItemSidebarEdit {
  update: (fn: (prev: ExtrasState) => ExtrasState) => void
  autoForma: {
    /** Forma steps the reactive plan would apply. */
    count: number
    /** Briefly true after a click that couldn't produce a plan. */
    noFix: boolean
    onClick: () => void
  }
}

export interface ItemSidebarProps {
  item: DetailItem
  category: BrowseCategory
  extras: ExtrasState
  capacity: { used: number; max: number }
  placedMods: Partial<Record<SlotId, PlacedMod>>
  placedArcanes: (PlacedArcane | null)[]
  /** Twin-frames: the active form's ability set, overriding `item.abilities`. */
  formAbilities?: Ability[]
  /** Absent in the read-only viewer. */
  edit?: ItemSidebarEdit
  /** Render without card chrome or the mobile "Show stats" toggle (inside the
   *  Stats popover, which provides both). */
  bare?: boolean
}

export function ItemSidebar({
  item,
  category,
  extras,
  capacity,
  placedMods,
  placedArcanes,
  formAbilities,
  edit,
  bare = false,
}: ItemSidebarProps) {
  const {
    hasReactor,
    shards,
    helminth,
    zawComponents,
    kitgunComponents,
    lichBonusElement,
    incarnonEnabled,
    incarnonPerks,
    deploymentContext,
    operatorAmp,
    focusSchool,
  } = extras
  const readOnly = !edit
  const update = (fn: (prev: ExtrasState) => ExtrasState) => edit?.update(fn)
  const set = (patch: Partial<ExtrasState>) =>
    update((prev) => ({ ...prev, ...patch }))

  const isZawItem = category === "melee" && isZawStrikeItem(item)
  const isKitgunItem =
    (category === "primary" || category === "secondary") &&
    isKitgunChamber(item.uniqueName)
  const cls = kitgunClass(category)
  const hasWeaponData = itemHasWeaponData(item)
  const hasStats = hasModCapacity(category)
  const isPureWarframe = category === "warframes"
  // A companion's own body stats; its weapon-like entries go through weapons.
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
  const abilities = formAbilities ?? item.abilities ?? []

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
    ? deploymentContext
    : "archwing"

  const isCustomAmp = isModularAmp(operatorAmp)
  const ampParts = isCustomAmp ? operatorAmp.split("-") : ["1", "1", "1"]
  const operatorAmpType = isCustomAmp
    ? "custom"
    : (operatorAmp ?? DEFAULT_OPERATOR_AMP)

  const updateAmpPart = (index: number, value: string) => {
    const next = [...ampParts]
    next[index] = value
    set({ operatorAmp: next.join("-") })
  }

  // Kitgun chambers ship zero-stat; reconstruct from the selected grip+loader
  // using the wiki-sourced modifier tables. Only fetched for kitgun items.
  const { data: modular } = useQuery({
    ...modularQuery,
    enabled: isKitgunItem,
  })

  const incarnonActive = showIncarnon && incarnonEnabled
  const { data: evolutions } = useQuery({
    ...incarnonEvolutionsQuery,
    enabled: incarnonActive,
  })
  const incarnonStats = useMemo(() => {
    const evolution = findIncarnonEvolution(evolutions, item.name)
    if (!incarnonActive || !evolution || !incarnonPerks) return undefined
    return incarnonPerkStats(evolution, incarnonPerks, item.name)
  }, [incarnonActive, evolutions, incarnonPerks, item.name])

  const [showMaxStacks, setShowMaxStacks] = useState(false)
  const {
    mods: modList,
    arcanes: arcaneList,
    isWarframe,
    warframeStats,
  } = useLoadoutStats({
    item,
    category,
    placedMods,
    placedArcanes,
    shards,
    showMaxStacks,
  })
  const boosterLabel = isWarframe ? "Reactor" : "Catalyst"

  // Stats panels fold on phones only. On sm+ (≥640px) the `sm:flex` rule
  // below forces the panel visible regardless of this state, so we default
  // to collapsed: the toggle button is sm:hidden and only flips this on
  // actual phones.
  const [statsExpanded, setStatsExpanded] = useState(false)
  const hasConditional = useMemo(
    () =>
      hasConditionalStats(modList, arcaneList) ||
      Boolean(incarnonStats?.some((s) => s.isConditional)),
    [modList, arcaneList, incarnonStats],
  )

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
        cls,
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
      incarnonStats,
    })
    // The Incarnon Form alt-fire is only available with the adapter installed.
    if (showIncarnon && !incarnonEnabled) {
      return {
        ...stats,
        attackModes: stats.attackModes.filter(
          (m) => !isIncarnonFormAttack(m.name),
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
    cls,
    modular,
    item,
    modList,
    arcaneList,
    showMaxStacks,
    showIncarnon,
    incarnonEnabled,
    effectiveDeploymentContext,
    lichBonusElement,
    incarnonStats,
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
                // Helminth is per-variant (and so per-form): each twin-frame
                // form shows its own subsume, or the raw ability when unset.
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
                    canSubsume={isPureWarframe && !!edit}
                    onSelectHelminth={(ab) =>
                      update((e) => withHelminth(e, i, ab))
                    }
                    totals={warframeStats ?? undefined}
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
                onChange={(zawComponents) => set({ zawComponents })}
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
                cls={cls}
                onChange={(kitgunComponents) => set({ kitgunComponents })}
                readOnly={readOnly}
              />
            </div>
            <Separator />
          </>
        )}

        {showShards && (
          <>
            <div className="flex justify-around p-3">
              {Array.from({ length: SHARD_SLOT_COUNT }).map((_, i) => (
                <ShardSlot
                  key={i}
                  shard={shards[i] ?? null}
                  onPick={
                    edit && ((s) => edit.update((e) => withShard(e, i, s)))
                  }
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
                  onCheckedChange={(on) => set({ incarnonEnabled: on })}
                  disabled={readOnly}
                />
              </div>
              {incarnonEnabled && (
                <Suspense fallback={<IncarnonTierGridSkeleton />}>
                  <IncarnonTierGrid
                    weaponName={item.name}
                    perks={incarnonPerks}
                    onPick={(tierIndex, perk) =>
                      update((e) => withIncarnonPerk(e, tierIndex, perk))
                    }
                    readOnly={readOnly}
                  />
                </Suspense>
              )}
            </div>
            <Separator />
          </>
        )}
        {category === "operators" && (
          <>
            <div className="flex flex-col gap-1.5 p-3">
              <span className="text-xs font-medium">Focus School</span>
              <Select
                items={FOCUS_SCHOOLS}
                value={focusSchool ?? null}
                onValueChange={(value) => {
                  if (value) set({ focusSchool: value })
                }}
                disabled={readOnly}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="None" />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {FOCUS_SCHOOLS.map((school) => (
                      <SelectItem key={school.value} value={school.value}>
                        {school.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>

            <Separator />

            <div className="flex flex-col gap-1.5 p-3">
              <span className="text-xs font-medium">Amp</span>

              <Select
                items={OPERATOR_AMP_TYPES}
                value={operatorAmpType}
                onValueChange={(value) => {
                  if (!value) return

                  if (value === "custom") {
                    if (!isCustomAmp) set({ operatorAmp: "1-1-1" })
                    return
                  }

                  set({ operatorAmp: value })
                }}
                disabled={readOnly}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>

                <SelectContent>
                  <SelectGroup>
                    {OPERATOR_AMP_TYPES.map((amp) => (
                      <SelectItem key={amp.value} value={amp.value}>
                        {amp.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>

              {isCustomAmp && (
                <div className="mt-1.5 flex flex-col gap-3">
                  {AMP_PARTS.map((part, index) => (
                    <div key={part.label} className="flex flex-col gap-1.5">
                      <span className="text-muted-foreground text-xs">
                        {part.label}
                      </span>
                      <Select
                        items={part.options}
                        value={ampParts[index]}
                        onValueChange={(value) => {
                          if (value) updateAmpPart(index, value)
                        }}
                        disabled={readOnly}
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectGroup>
                            {part.options.map((option) => (
                              <SelectItem
                                key={option.value}
                                value={option.value}
                              >
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        </SelectContent>
                      </Select>
                    </div>
                  ))}

                  <div className="bg-muted/30 rounded-md border px-3 py-2">
                    <div className="text-muted-foreground text-[11px] uppercase">
                      Amp Configuration
                    </div>
                    <div className="mt-0.5 font-mono text-lg font-semibold">
                      {ampParts.join("-")}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
        {hasModCapacity(category) && (
          <div className="flex flex-col gap-2 p-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium">{boosterLabel}</span>
              <Switch
                size="sm"
                checked={hasReactor}
                onCheckedChange={(on) => set({ hasReactor: on })}
                disabled={readOnly}
              />
            </div>

            <CapacityBar
              used={capacity.used}
              max={capacity.max}
              autoFormaCount={edit?.autoForma.count}
              autoFormaNoFix={edit?.autoForma.noFix}
              onAutoForma={edit?.autoForma.onClick}
            />
          </div>
        )}

        {/* `sm:flex` is unconditional so desktop visibility never depends on
            `statsExpanded` — the toggle that flips it is `sm:hidden`. Operators
            have no stat panel, so the whole section (and its toggle) is
            skipped. */}
        <div
          className={cn(
            "flex-col sm:flex",
            statsExpanded ? "flex" : "hidden",
            !hasStats && "sm:hidden",
          )}
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
                    set({ deploymentContext: v as DeploymentContext })
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
                value={lichBonusElement}
                onChange={(v) => set({ lichBonusElement: v })}
                readOnly={readOnly}
              />
            )}
            {warframeStats && <WarframeStatsPanel stats={warframeStats} />}
            {weaponStats && <WeaponStatsPanel stats={weaponStats} />}
            {companionStats && <CompanionStatsPanel stats={companionStats} />}
          </div>
        </div>
      </div>
      {!bare && hasStats && (
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
