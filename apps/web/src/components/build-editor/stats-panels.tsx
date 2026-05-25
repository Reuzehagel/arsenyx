import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Separator } from "@/components/ui/separator"
import {
  DAMAGE_TYPE_ICON,
  DAMAGE_TYPE_LABELS,
  DAMAGE_TYPE_STYLE,
  type AttackModeStats,
  type CompanionStats,
  type DamageEntry,
  type DamageType,
  type StatValue,
  type WarframeStats,
  type WeaponStats,
} from "@/lib/stats"
import { cn } from "@/lib/util/utils"
import { formatStat } from "@/lib/warframe"

import { useAbilityStatReorder } from "./ability-stat-reorder"
import {
  ContribRow,
  formatContribAmount,
  formatSum,
  groupContributions,
  StatLine,
} from "./stat-display"
import {
  useAbilityStatOrder,
  type AbilityStatKey,
} from "./use-ability-stat-order"

export function CompanionStatsPanel({ stats }: { stats: CompanionStats }) {
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

export function WarframeStatsPanel({ stats }: { stats: WarframeStats }) {
  const [order, setOrder] = useAbilityStatOrder()
  const reorder = useAbilityStatReorder(order, setOrder)

  const rows: Record<AbilityStatKey, { label: string; value: StatValue }> = {
    strength: { label: "Strength", value: stats.abilityStrength },
    duration: { label: "Duration", value: stats.abilityDuration },
    efficiency: { label: "Efficiency", value: stats.abilityEfficiency },
    range: { label: "Range", value: stats.abilityRange },
  }

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
        {order.map((key) => {
          const row = rows[key]
          return (
            <div
              key={key}
              {...reorder.rowProps(
                key,
                row.label,
                `${formatStat(row.value.modified, 1)}%`,
              )}
            >
              <StatLine
                label={row.label}
                value={row.value}
                unit="%"
                digits={1}
              />
            </div>
          )
        })}
      </div>
      {reorder.ghost}
    </>
  )
}

export function WeaponStatsPanel({ stats }: { stats: WeaponStats }) {
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

function DamageTypeIcon({ type }: { type: DamageType }) {
  const icon = DAMAGE_TYPE_ICON[type]
  if (icon) {
    return <img src={icon} alt="" aria-hidden className="size-3.5 shrink-0" />
  }
  return (
    <span className={cn("size-1.5 rounded-full", DAMAGE_TYPE_STYLE[type].bg)} />
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
        <DamageTypeIcon type={entry.type} />
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
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <DamageTypeIcon type={entry.type} />
          <span
            className={cn("font-semibold", DAMAGE_TYPE_STYLE[entry.type].text)}
          >
            {DAMAGE_TYPE_LABELS[entry.type]}
          </span>
        </span>
        <span
          className={cn(
            "font-semibold tabular-nums",
            DAMAGE_TYPE_STYLE[entry.type].text,
          )}
        >
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
