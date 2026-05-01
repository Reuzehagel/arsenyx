import {
  getIncarnonBaseName,
  hasIncarnon,
  INCARNON_FORM_ATTACK_NAME,
  type IncarnonEvolution,
} from "@arsenyx/shared/warframe/incarnon-data"
import {
  LICH_BONUS_ELEMENTS,
  type Gun,
  type LichBonusElement,
  type Melee,
  type Warframe,
} from "@arsenyx/shared/warframe/types"
import { isZawStrike } from "@arsenyx/shared/warframe/zaw-data"
import { useSuspenseQuery } from "@tanstack/react-query"
import {
  ChevronDown,
  ChevronLeft,
  Plus,
  SlidersHorizontal,
  Undo2,
  X,
  Zap,
} from "lucide-react"
import { Suspense, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { helminthQuery, type HelminthAbility } from "@/lib/helminth-query"
import { incarnonEvolutionsQuery } from "@/lib/incarnon-query"
import {
  getShardImageUrl,
  SHARD_COLOR_NAMES,
  SHARD_COLORS,
  SHARD_STATS,
  type PlacedShard,
  type ShardColor,
  formatStatValue,
} from "@/lib/shards"
import {
  calculateCompanionStats,
  calculateWarframeStats,
  calculateWeaponStats,
  DAMAGE_TYPE_LABELS,
  DAMAGE_TYPE_STYLE,
  formatWithSign,
  hasConditionalStats,
  type AttackModeStats,
  type CompanionStats,
  type DamageEntry,
  type StatContribution,
  type StatValue,
  type WarframeStats,
  type WeaponStats,
} from "@/lib/stats"
import { cn } from "@/lib/utils"
import {
  type BrowseCategory,
  type DetailItem,
  formatStat,
  getImageUrl,
} from "@/lib/warframe"
import { adjustStrikeForZaw } from "@/lib/zaw-stats"

import { isLichWeapon } from "./layout"
import type { PlacedArcane } from "./use-arcane-slots"
import type { PlacedMod, SlotId } from "./use-build-slots"
import { ZawComponentSelector } from "./zaw-component-selector"

const SHARD_SLOTS = 5

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
  hasReactor: boolean
  onToggleReactor: () => void
  shards: (PlacedShard | null)[]
  onSetShard: (index: number, shard: PlacedShard | null) => void
  helminth: Record<number, HelminthAbility>
  onSetHelminth: (slotIndex: number, ability: HelminthAbility | null) => void
  zawComponents?: { grip: string; link: string }
  onSetZawComponents?: (components: { grip: string; link: string }) => void
  lichBonusElement?: LichBonusElement | null
  onSetLichBonusElement?: (value: LichBonusElement | null) => void
  incarnonEnabled?: boolean
  onToggleIncarnon?: () => void
  incarnonPerks?: (string | null)[]
  onSetIncarnonPerk?: (tierIndex: number, perkName: string | null) => void
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
  hasReactor,
  onToggleReactor,
  shards,
  onSetShard,
  helminth,
  onSetHelminth,
  zawComponents,
  onSetZawComponents,
  lichBonusElement,
  onSetLichBonusElement,
  incarnonEnabled = false,
  onToggleIncarnon,
  incarnonPerks,
  onSetIncarnonPerk,
  placedMods,
  placedArcanes,
  readOnly = false,
  bare = false,
}: ItemSidebarProps) {
  const isZawItem = category === "melee" && isZawStrike(item.name)
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

  const modList = useMemo(
    () =>
      Object.values(placedMods).filter((p): p is PlacedMod => p !== undefined),
    [placedMods],
  )
  const arcaneList = useMemo(
    () => placedArcanes.filter((a): a is PlacedArcane => !!a),
    [placedArcanes],
  )

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
    const weapon =
      isZawItem && zawComponents
        ? adjustStrikeForZaw(
            baseWeapon,
            item.name,
            zawComponents.grip,
            zawComponents.link,
          )
        : baseWeapon
    const stats = calculateWeaponStats({
      weapon,
      mods: modList,
      arcanes: arcaneList,
      showMaxStacks,
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
    item,
    modList,
    arcaneList,
    showMaxStacks,
    showIncarnon,
    incarnonEnabled,
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

          <CapacityBar used={capacityUsed} max={capacityMax} />
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

const LICH_BONUS_ITEMS: { value: LichBonusElement | null; label: string }[] = [
  { value: null, label: "No element selected" },
  ...LICH_BONUS_ELEMENTS.map((el) => ({ value: el, label: `+60% ${el}` })),
]

function LichBonusElementPicker({
  value,
  onChange,
  readOnly,
}: {
  value: LichBonusElement | null
  onChange: (v: LichBonusElement | null) => void
  readOnly: boolean
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-muted-foreground text-[10px] font-semibold tracking-wider uppercase">
        Bonus Element
      </span>
      <Select
        items={LICH_BONUS_ITEMS}
        value={value}
        onValueChange={(v) => onChange(v as LichBonusElement | null)}
        disabled={readOnly}
      >
        <SelectTrigger size="sm" className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            {LICH_BONUS_ITEMS.map((item) => (
              <SelectItem key={item.value ?? "none"} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectGroup>
        </SelectContent>
      </Select>
    </div>
  )
}

function CompanionStatsPanel({ stats }: { stats: CompanionStats }) {
  return (
    <div className="flex flex-col gap-1 text-xs">
      {stats.health.base > 0 && (
        <StatLine label="Health" value={stats.health} digits={0} />
      )}
      {stats.shield.base > 0 && (
        <StatLine label="Shield" value={stats.shield} digits={0} />
      )}
      {stats.armor.base > 0 && (
        <StatLine label="Armor" value={stats.armor} digits={0} />
      )}
      {stats.energy.base > 0 && (
        <StatLine label="Energy" value={stats.energy} digits={0} />
      )}
    </div>
  )
}

function WarframeStatsPanel({ stats }: { stats: WarframeStats }) {
  return (
    <>
      <div className="flex flex-col gap-1 text-xs">
        <StatLine label="Health" value={stats.health} digits={0} />
        <StatLine label="Shield" value={stats.shield} digits={0} />
        <StatLine label="Armor" value={stats.armor} digits={0} />
        <StatLine label="Energy" value={stats.energy} digits={0} />
        <StatLine label="Sprint" value={stats.sprintSpeed} digits={2} />
      </div>

      <Separator />

      <div className="flex flex-col gap-1 text-xs">
        <StatLine
          label="Strength"
          value={stats.abilityStrength}
          unit="%"
          digits={1}
        />
        <StatLine
          label="Duration"
          value={stats.abilityDuration}
          unit="%"
          digits={1}
        />
        <StatLine
          label="Efficiency"
          value={stats.abilityEfficiency}
          unit="%"
          digits={1}
        />
        <StatLine
          label="Range"
          value={stats.abilityRange}
          unit="%"
          digits={1}
        />
      </div>
    </>
  )
}

function WeaponStatsPanel({ stats }: { stats: WeaponStats }) {
  const { attackModes, multishot, grandTotalDamage } = stats
  const showMultiple = attackModes.length > 1
  const primary = attackModes[0]

  return (
    <div className="flex flex-col gap-3 text-xs">
      {primary && (
        <div className="flex flex-col gap-1">
          <StatLine
            label="Crit Chance"
            value={primary.criticalChance}
            unit="%"
            digits={1}
          />
          <StatLine
            label="Crit Multi"
            value={primary.criticalMultiplier}
            unit="x"
            digits={2}
          />
          <StatLine
            label="Status"
            value={primary.statusChance}
            unit="%"
            digits={1}
          />
          <StatLine label="Fire Rate" value={primary.fireRate} digits={2} />
          {primary.magazineSize && (
            <StatLine
              label="Magazine"
              value={primary.magazineSize}
              digits={0}
            />
          )}
          {primary.reloadTime && (
            <StatLine
              label="Reload"
              value={primary.reloadTime}
              unit="s"
              digits={2}
              inverted
            />
          )}
          {multishot.modified > 1.001 && (
            <StatLine label="Multishot" value={multishot} unit="x" digits={2} />
          )}
          {primary.range && (
            <StatLine label="Range" value={primary.range} unit="m" digits={2} />
          )}
        </div>
      )}

      {attackModes.map((mode, i) => (
        <AttackModeBlock
          key={`${mode.name}-${i}`}
          mode={mode}
          multishot={multishot.modified}
          showHeader={showMultiple}
        />
      ))}

      {showMultiple && (
        <>
          <Separator />
          <StatLine
            label="Total"
            value={grandTotalDamage}
            digits={1}
            emphasis
          />
        </>
      )}
    </div>
  )
}

function AttackModeBlock({
  mode,
  multishot,
  showHeader,
}: {
  mode: AttackModeStats
  multishot: number
  showHeader: boolean
}) {
  const scaledTotal: StatValue = {
    base: mode.totalDamage.base * multishot,
    modified: mode.totalDamage.modified * multishot,
    contributions: mode.totalDamage.contributions,
  }

  const physical = mode.damageBreakdown.physical
  const elemental = mode.damageBreakdown.elemental

  return (
    <div className="flex flex-col gap-1.5">
      {showHeader && (
        <>
          <Separator />
          <div className="text-muted-foreground mt-1 text-[10px] font-semibold tracking-wide uppercase">
            {mode.name}
          </div>
        </>
      )}
      <StatLine label="Total Damage" value={scaledTotal} digits={1} emphasis />

      {physical.length > 0 && (
        <>
          <DamageSectionHeader label="Physical" />
          <div className="flex flex-col gap-0.5">
            {physical.map((d) => (
              <DamageRow key={d.type} entry={d} multishot={multishot} />
            ))}
          </div>
        </>
      )}

      {elemental.length > 0 && (
        <>
          <DamageSectionHeader label="Elemental" />
          <div className="flex flex-col gap-0.5">
            {elemental.map((d, i) => (
              <DamageRow
                key={`${d.type}-${i}`}
                entry={d}
                multishot={multishot}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function DamageSectionHeader({ label }: { label: string }) {
  return (
    <div className="text-muted-foreground/70 mt-1 text-[9px] font-semibold tracking-wider uppercase">
      {label}
    </div>
  )
}

function DamageRow({
  entry,
  multishot,
}: {
  entry: DamageEntry
  multishot: number
}) {
  const scaled = entry.value * multishot
  const row = (
    <div className="flex cursor-help items-baseline justify-between">
      <span className="flex items-center gap-1.5">
        <span
          className={cn(
            "size-1.5 rounded-full",
            DAMAGE_TYPE_STYLE[entry.type].bg,
          )}
        />
        <span className={cn(DAMAGE_TYPE_STYLE[entry.type].text)}>
          {DAMAGE_TYPE_LABELS[entry.type]}
        </span>
      </span>
      <span className="font-medium tabular-nums">{formatStat(scaled, 1)}</span>
    </div>
  )

  if (entry.contributions.length === 0) return row

  return (
    <Popover>
      <PopoverTrigger nativeButton={false} render={row} />
      <PopoverContent side="right" align="start" className="w-72 text-xs">
        <DamageFormula entry={entry} multishot={multishot} />
      </PopoverContent>
    </Popover>
  )
}

function DamageFormula({
  entry,
  multishot,
}: {
  entry: DamageEntry
  multishot: number
}) {
  const grouped = groupContributions(entry.contributions)
  const scaled = entry.value * multishot
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span
          className={cn("font-semibold", DAMAGE_TYPE_STYLE[entry.type].text)}
        >
          {DAMAGE_TYPE_LABELS[entry.type]}
        </span>
        <span className="font-semibold tabular-nums">
          {formatStat(scaled, 1)}
        </span>
      </div>
      {grouped.map((g, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <Separator />
          <div className="text-muted-foreground text-[10px] tracking-wide uppercase">
            {g.label}{" "}
            <span className="tabular-nums">({formatSum(g.contribs)})</span>
          </div>
          {g.contribs.map((c, j) => (
            <ContribRow
              key={j}
              name={c.name}
              amount={formatContribAmount(c)}
              positive={c.amount > 0}
            />
          ))}
        </div>
      ))}
      {multishot > 1.001 && (
        <>
          <Separator />
          <div className="text-muted-foreground text-[10px]">
            × {formatStat(multishot, 2)} multishot
          </div>
        </>
      )}
    </div>
  )
}

function groupContributions(
  contribs: StatContribution[],
): { label: string; contribs: StatContribution[] }[] {
  const groups = new Map<string, StatContribution[]>()
  for (const c of contribs) {
    const key = c.group ?? ""
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(c)
  }
  return Array.from(groups, ([label, contribs]) => ({ label, contribs }))
}

function formatSum(contribs: StatContribution[]): string {
  const sum = contribs.reduce((t, c) => t + c.amount, 0)
  const sign = sum >= 0 ? "+" : ""
  return `${sign}${formatStat(sum, 1)}%`
}

function formatContribAmount(c: StatContribution): string {
  return formatWithSign(c.amount, 1, c.operation === "percent_add" ? "%" : "")
}

function StatLine({
  label,
  value,
  unit = "",
  digits = 2,
  inverted = false,
  emphasis = false,
}: {
  label: string
  value: StatValue
  unit?: string
  digits?: number
  inverted?: boolean
  emphasis?: boolean
}) {
  const delta = value.modified - value.base
  const changed = Math.abs(delta) > 0.005
  const capped = value.uncapped !== undefined
  const better = inverted ? delta < 0 : delta > 0
  const color = !changed ? "" : better ? "text-green-500" : "text-red-500"

  const row = (
    <div
      className={cn(
        "flex items-baseline justify-between",
        changed && "cursor-help",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          emphasis ? "font-semibold" : "font-medium",
          color,
        )}
      >
        {formatStat(value.modified, digits)}
        {unit}
        {capped && (
          <span className="text-muted-foreground ml-1 text-[10px] font-normal">
            ({formatStat(value.uncapped!, digits)}
            {unit})
          </span>
        )}
      </span>
    </div>
  )

  if (!changed || value.contributions.length === 0) return row

  return (
    <Popover>
      <PopoverTrigger nativeButton={false} render={row} />
      <PopoverContent side="right" align="start" className="w-64 text-xs">
        <StatFormula
          value={value}
          unit={unit}
          digits={digits}
          inverted={inverted}
        />
      </PopoverContent>
    </Popover>
  )
}

function StatFormula({
  value,
  unit,
  digits,
  inverted,
}: {
  value: StatValue
  unit: string
  digits: number
  inverted: boolean
}) {
  const hasGroups = value.contributions.some((c) => c.group)
  const flats = value.contributions.filter((c) => c.operation === "flat_add")
  const percents = value.contributions.filter(
    (c) => c.operation === "percent_add",
  )
  const percentSum = percents.reduce((s, c) => s + c.amount, 0)
  const flatSum = flats.reduce((s, c) => s + c.amount, 0)

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-muted-foreground">Base</span>
        <span className="tabular-nums">
          {formatStat(value.base, digits)}
          {unit}
        </span>
      </div>

      {hasGroups ? (
        <GroupedContribs contribs={value.contributions} />
      ) : (
        <>
          {percents.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-col gap-0.5">
                {percents.map((c, i) => (
                  <ContribRow
                    key={`p-${i}`}
                    name={c.name}
                    amount={formatContribAmount(c)}
                    positive={c.amount > 0}
                  />
                ))}
              </div>
            </>
          )}

          {flats.length > 0 && (
            <>
              <Separator />
              <div className="flex flex-col gap-0.5">
                {flats.map((c, i) => (
                  <ContribRow
                    key={`f-${i}`}
                    name={c.name}
                    amount={formatWithSign(c.amount, digits, unit)}
                    positive={c.amount > 0}
                  />
                ))}
              </div>
            </>
          )}

          <Separator />
          <div className="text-muted-foreground text-[10px]">
            {inverted ? (
              <>
                {formatStat(value.base, digits)} ÷ (1 +{" "}
                {formatStat(percentSum / 100, 2)})
              </>
            ) : (
              <>
                {formatStat(value.base, digits)} × (1 +{" "}
                {formatStat(percentSum / 100, 2)})
                {flatSum !== 0 && ` + ${formatStat(flatSum, digits)}`}
              </>
            )}
          </div>
        </>
      )}

      <Separator />
      {value.uncapped !== undefined && (
        <div className="text-muted-foreground flex items-baseline justify-between">
          <span>Uncapped</span>
          <span className="tabular-nums">
            {formatStat(value.uncapped, digits)}
            {unit}
          </span>
        </div>
      )}
      <div className="flex items-baseline justify-between font-medium">
        <span>{value.uncapped !== undefined ? "Capped" : "Total"}</span>
        <span className="tabular-nums">
          {formatStat(value.modified, digits)}
          {unit}
        </span>
      </div>
    </div>
  )
}

function GroupedContribs({ contribs }: { contribs: StatContribution[] }) {
  const groups = groupContributions(contribs)
  return (
    <>
      {groups.map((g, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          <Separator />
          <div className="text-muted-foreground text-[10px] tracking-wide uppercase">
            {g.label || "Other"}{" "}
            <span className="tabular-nums">({formatSum(g.contribs)})</span>
          </div>
          {g.contribs.map((c, j) => (
            <ContribRow
              key={j}
              name={c.name}
              amount={formatContribAmount(c)}
              positive={c.amount > 0}
            />
          ))}
        </div>
      ))}
    </>
  )
}

function ContribRow({
  name,
  amount,
  positive,
}: {
  name: string
  amount: string
  positive: boolean
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-muted-foreground truncate">{name}</span>
      <span
        className={cn(
          "shrink-0 tabular-nums",
          positive ? "text-green-500" : "text-red-500",
        )}
      >
        {amount}
      </span>
    </div>
  )
}

function AbilityIcon({
  ability,
  isHelminth,
  canSubsume,
  onSelectHelminth,
}: {
  ability: { name: string; description: string; imageName?: string }
  isHelminth: boolean
  canSubsume: boolean
  onSelectHelminth: (ability: HelminthAbility | null) => void
}) {
  const [open, setOpen] = useState(false)
  const triggerButton = (
    <button
      type="button"
      className={cn(
        "bg-muted relative size-10 overflow-hidden rounded-sm border transition-colors",
        isHelminth
          ? "border-destructive/60"
          : "border-border hover:border-muted-foreground/60",
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

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger render={<PopoverTrigger render={triggerButton} />} />
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="font-semibold">{ability.name}</p>
          <p className="text-muted-foreground mt-0.5 whitespace-pre-line">
            {ability.description}
          </p>
        </TooltipContent>
      </Tooltip>
      {canSubsume && (
        <PopoverContent side="bottom" align="center" className="w-72">
          <Suspense
            fallback={<p className="text-muted-foreground text-xs">Loading…</p>}
          >
            <HelminthPicker
              isHelminth={isHelminth}
              onPick={(ab) => {
                onSelectHelminth(ab)
                setOpen(false)
              }}
            />
          </Suspense>
        </PopoverContent>
      )}
    </Popover>
  )
}

function HelminthPicker({
  isHelminth,
  onPick,
}: {
  isHelminth: boolean
  onPick: (ability: HelminthAbility | null) => void
}) {
  const { data } = useSuspenseQuery(helminthQuery)
  const [query, setQuery] = useState("")
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return data
    return data.filter(
      (a) =>
        a.name.toLowerCase().includes(q) || a.source.toLowerCase().includes(q),
    )
  }, [data, query])

  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-[10px] font-medium uppercase">
        Helminth
      </span>
      {isHelminth && (
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPick(null)}
          className="justify-start gap-2"
        >
          <Undo2 className="size-3" />
          Restore Original
        </Button>
      )}
      <Input
        placeholder="Search abilities…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-7 text-xs"
      />
      <div className="flex max-h-56 flex-col gap-0.5 overflow-y-auto">
        {filtered.map((a) => (
          <button
            key={a.uniqueName}
            type="button"
            onClick={() => onPick(a)}
            className="hover:bg-muted flex items-center gap-2 rounded px-1.5 py-1 text-left text-xs transition-colors"
          >
            {a.imageName ? (
              <img
                src={getImageUrl(a.imageName)}
                alt=""
                className="size-6 shrink-0 rounded-sm"
              />
            ) : (
              <div className="bg-muted size-6 shrink-0 rounded-sm" />
            )}
            <div className="flex min-w-0 flex-col">
              <span className="truncate font-medium">{a.name}</span>
              <span className="text-muted-foreground truncate text-[10px]">
                {a.source}
              </span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <span className="text-muted-foreground px-1.5 py-1 text-xs">
            No matches.
          </span>
        )}
      </div>
    </div>
  )
}

function IncarnonTierGridSkeleton() {
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

function IncarnonTierGrid({
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

function CapacityBar({ used, max }: { used: number; max: number }) {
  const pctVal = max > 0 ? Math.min(100, (used / max) * 100) : 0
  const over = used > max
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">Capacity</span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            over && "text-destructive",
          )}
        >
          {used} / {max}
        </span>
      </div>
      <div className="bg-muted h-1.5 w-full overflow-hidden rounded-full">
        <div
          className={cn(
            "h-full transition-all",
            over ? "bg-destructive" : "bg-primary",
          )}
          style={{ width: `${pctVal}%` }}
        />
      </div>
    </div>
  )
}

function ShardSlot({
  shard,
  onPick,
  readOnly = false,
}: {
  shard: PlacedShard | null
  onPick: (s: PlacedShard | null) => void
  readOnly?: boolean
}) {
  const [open, setOpen] = useState(false)
  const triggerButton = (
    <button
      type="button"
      className={cn(
        "relative flex size-10 items-center justify-center rounded-sm border transition-colors",
        shard
          ? "bg-muted/40 border-border hover:border-muted-foreground/60"
          : "border-muted-foreground/10 hover:border-muted-foreground/25 border-dashed",
      )}
    >
      {shard ? (
        <img
          src={getShardImageUrl(shard.color, shard.tauforged)}
          alt=""
          className="size-9"
        />
      ) : (
        <Plus className="text-muted-foreground/20 size-4" />
      )}
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
        <TooltipContent side="bottom">
          {shard ? (
            <>
              <p className="font-semibold">
                {SHARD_COLOR_NAMES[shard.color]}
                {shard.tauforged ? " (Tauforged)" : ""}
              </p>
              <p className="text-muted-foreground mt-0.5">{shard.stat}</p>
            </>
          ) : (
            <span className="text-muted-foreground">Empty shard slot</span>
          )}
        </TooltipContent>
      </Tooltip>
      {!readOnly && (
        <PopoverContent side="right" align="start" className="w-72">
          <ShardPicker
            current={shard}
            onPick={(s) => {
              onPick(s)
              setOpen(false)
            }}
            onClear={() => {
              onPick(null)
              setOpen(false)
            }}
          />
        </PopoverContent>
      )}
    </Popover>
  )
}

function ShardPicker({
  current,
  onPick,
  onClear,
}: {
  current: PlacedShard | null
  onPick: (s: PlacedShard) => void
  onClear: () => void
}) {
  const [color, setColor] = useState<ShardColor | null>(current?.color ?? null)
  const [tauforged, setTauforged] = useState(current?.tauforged ?? true)

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {color && (
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => setColor(null)}
              title="Back"
              className="-ml-1"
            >
              <ChevronLeft className="size-3.5" />
            </Button>
          )}
          <span className="text-xs font-medium">
            {color ? "Select Stat" : "Select Color"}
          </span>
        </div>
        {current && (
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClear}
            title="Remove shard"
          >
            <X className="size-3" />
          </Button>
        )}
      </div>

      {!color && (
        <div className="grid grid-cols-3 gap-1">
          {SHARD_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className="hover:bg-muted flex flex-col items-center gap-1 rounded-md p-1.5 transition-colors"
            >
              <img src={getShardImageUrl(c, false)} alt="" className="size-8" />
              <span className="text-[10px]">{SHARD_COLOR_NAMES[c]}</span>
            </button>
          ))}
        </div>
      )}

      {color && (
        <>
          <label className="hover:bg-muted flex cursor-pointer items-center justify-between gap-2 rounded px-1.5 py-1 text-xs transition-colors">
            <span className="text-muted-foreground">Tauforged (1.5×)</span>
            <Switch
              size="sm"
              checked={tauforged}
              onCheckedChange={setTauforged}
            />
          </label>

          <div className="flex flex-col gap-0.5">
            {SHARD_STATS[color].map((s) => {
              const isActive =
                current?.color === color &&
                current.stat === s.name &&
                current.tauforged === tauforged
              return (
                <button
                  key={s.name}
                  type="button"
                  onClick={() => onPick({ color, stat: s.name, tauforged })}
                  className={cn(
                    "hover:bg-muted flex items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-xs transition-colors",
                    isActive && "bg-muted",
                  )}
                >
                  <span>{s.name}</span>
                  <span className="text-muted-foreground shrink-0 tabular-nums">
                    {formatStatValue(s, tauforged)}
                  </span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
