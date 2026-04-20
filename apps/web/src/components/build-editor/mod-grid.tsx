import { isRivenMod } from "@arsenyx/shared/warframe/rivens"
import type { Arcane, Polarity } from "@arsenyx/shared/warframe/types"

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
  const slotsPerRow = isCompanion ? 5 : 4

  const auraPolarities = getAuraPolarities(item, auraSlotCount)
  const polarities = item.polarities ?? []

  const normalRows: number[][] = []
  for (let i = 0; i < normalSlotCount; i += slotsPerRow) {
    normalRows.push(
      Array.from(
        { length: Math.min(slotsPerRow, normalSlotCount - i) },
        (_, j) => i + j,
      ),
    )
  }

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

  return (
    <div className="flex flex-col gap-6 sm:gap-4">
      {(auraSlotCount > 0 || showExilus) && (
        <div className="flex w-full justify-center gap-2 sm:gap-4">
          {auraSlotCount > 0 && (
            <ModSlot
              kind="aura"
              {...slotProps("aura-0" as SlotId, auraPolarities[0])}
            />
          )}
          {showExilus && (
            <ModSlot kind="exilus" {...slotProps("exilus", undefined)} />
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

      {isCompanion ? (
        <div className="grid grid-cols-2 gap-x-2 gap-y-6 lg:mx-auto lg:w-fit lg:grid-cols-5 lg:gap-4">
          {Array.from({ length: normalSlotCount }, (_, i) => {
            const id: SlotId = `normal-${i}`
            return (
              <ModSlot key={i} {...slotProps(id, toPolarity(polarities[i]))} />
            )
          })}
        </div>
      ) : (
        normalRows.map((row, rowIdx) => (
          <div
            key={rowIdx}
            className="grid grid-cols-2 justify-center gap-x-2 gap-y-6 sm:flex sm:gap-4"
          >
            {row.map((i) => {
              const id: SlotId = `normal-${i}`
              return (
                <ModSlot key={i} {...slotProps(id, toPolarity(polarities[i]))} />
              )
            })}
          </div>
        ))
      )}

      {arcaneRow}
    </div>
  )
}
