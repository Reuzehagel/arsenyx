import { isRivenMod } from "@arsenyx/shared/warframe/rivens"
import type { Arcane, Polarity } from "@arsenyx/shared/warframe/types"

import { cn } from "@/lib/utils"
import type { BrowseCategory, DetailItem } from "@/lib/warframe"

import { ArcaneSlot } from "./arcane-slot"
import { getAuraSlotCount, hasExilusSlot } from "./layout"
import { ModSlot } from "./mod-slot"
import { CANONICAL_POLARITIES } from "./polarity-picker"
import type { ArcaneSlotsState } from "./use-arcane-slots"
import type { BuildSlotsState, SlotId } from "./use-build-slots"

const CANONICAL_SET = new Set<Polarity>(CANONICAL_POLARITIES)

export function toPolarity(v: string | undefined): Polarity | undefined {
  if (!v) return undefined
  return CANONICAL_SET.has(v as Polarity) ? (v as Polarity) : undefined
}

/**
 * Per-slot innate polarities for an item's aura slots. `item.aura` may be a
 * single polarity string (most frames) or an array (Jade: 2 slots). Length
 * always matches `count` so callers can zip by index.
 */
export function getAuraPolarities(
  item: Pick<DetailItem, "aura">,
  count: number,
): (Polarity | undefined)[] {
  const raws = Array.isArray(item.aura)
    ? item.aura
    : item.aura
      ? [item.aura]
      : []
  return Array.from({ length: count }, (_, i) => toPolarity(raws[i]))
}

/**
 * Innate exilus polarity, sourced from WFCD's `exilusPolarity` field
 * (extracted from the Warframe wiki's `Module:Weapons/data` /
 * `Module:Warframes/data` Lua tables).
 */
export function getExilusInnatePolarity(
  item: Pick<DetailItem, "exilusPolarity">,
): Polarity | undefined {
  return toPolarity(item.exilusPolarity)
}

export function ArcaneRow({
  count,
  arcanes,
  options,
  readOnly = false,
}: {
  count: number
  arcanes: ArcaneSlotsState
  options: Arcane[]
  readOnly?: boolean
}) {
  return (
    <div className="flex w-full items-start justify-center gap-3 sm:gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ArcaneSlot
          key={i}
          options={options}
          placed={arcanes.placed[i]}
          usedNames={arcanes.usedNames}
          selected={arcanes.selected === i}
          onSelect={() => arcanes.select(i)}
          onPick={(a) => arcanes.placeAt(i, a)}
          onRemove={() => arcanes.remove(i)}
          onRankChange={(delta) =>
            arcanes.setRank(i, (arcanes.placed[i]?.rank ?? 0) + delta)
          }
          readOnly={readOnly}
        />
      ))}
    </div>
  )
}

export function ModGrid({
  item,
  category,
  isCompanion,
  normalSlotCount,
  slots,
  onEditRiven,
  arcaneRow,
  readOnly = false,
}: {
  item: DetailItem
  category: BrowseCategory
  isCompanion: boolean
  normalSlotCount: number
  slots: BuildSlotsState
  onEditRiven?: (id: SlotId) => void
  arcaneRow?: React.ReactNode
  readOnly?: boolean
}) {
  const auraSlotCount = getAuraSlotCount(category, item)
  const showExilus = hasExilusSlot(category)

  const auraPolarities = getAuraPolarities(item, auraSlotCount)
  const polarities = item.polarities ?? []

  const slotProps = (id: SlotId, innate?: Polarity) => {
    const placed = slots.placed[id]
    const forma = slots.formaPolarities[id]
    return {
      slotPolarity: innate,
      formaPolarity: forma,
      mod: placed?.mod,
      rank: placed?.rank,
      selected: slots.selected === id,
      onClick: () => slots.select(id),
      onRemove: placed ? () => slots.remove(id) : undefined,
      onPickPolarity: (p: Polarity) => slots.setForma(id, p),
      onRankChange: placed
        ? (delta: number) => slots.setRank(id, placed.rank + delta)
        : undefined,
      onEditRiven:
        placed && onEditRiven && isRivenMod(placed.mod)
          ? () => onEditRiven(id)
          : undefined,
      readOnly,
    }
  }

  // Auto-arranging mod grid. The aura/exilus row stays centered at the top.
  // Below it, normal mods flow into a flex-wrap wrap whose max-width
  // steps up at wrap-query breakpoints, giving 2 → 3 → 4 (→ 5 for
  // companions) columns. Slots are a fixed 184px each (see mod-slot.tsx);
  // the column count is what changes, not the slot size. Buffers between
  // breakpoints leave breathing room when resizing inside a given column
  // count before the next reflow.
  return (
    <div className="flex flex-col gap-6">
      {(auraSlotCount > 0 || showExilus) && (
        <div className="flex w-full flex-wrap justify-center gap-4">
          {auraSlotCount > 0 && (
            <ModSlot
              kind="aura"
              {...slotProps("aura-0" as SlotId, auraPolarities[0])}
            />
          )}
          {showExilus && (
            <ModSlot
              kind="exilus"
              {...slotProps("exilus", getExilusInnatePolarity(item))}
            />
          )}
          {Array.from({ length: Math.max(0, auraSlotCount - 1) }, (_, i) => {
            const idx = i + 1
            const id = `aura-${idx}` as SlotId
            return (
              <ModSlot
                key={id}
                kind="aura"
                {...slotProps(id, auraPolarities[idx])}
              />
            )
          })}
        </div>
      )}

      <div
        className={cn(
          // Fixed upper bound = max column count × card width + gaps.
          // A single max-width means the grid never snaps wider — flex-wrap
          // handles 2→3→4 reflow within the same boundary.
          "mx-auto flex flex-wrap justify-center gap-x-4 gap-y-6",
          isCompanion ? "max-w-[984px]" : "max-w-[784px]",
        )}
      >
        {Array.from({ length: normalSlotCount }, (_, i) => {
          const id: SlotId = `normal-${i}`
          return (
            <ModSlot key={i} {...slotProps(id, toPolarity(polarities[i]))} />
          )
        })}
      </div>

      {arcaneRow}
    </div>
  )
}
