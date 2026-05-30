import { isRivenMod } from "@arsenyx/shared/warframe/rivens"
import type { Arcane, Polarity } from "@arsenyx/shared/warframe/types"

import { cn } from "@/lib/util/utils"
import type { BrowseCategory, DetailItem } from "@/lib/warframe"

import { ArcaneSlot } from "./arcane"
import { PLEXUS_GROUPS } from "./layout"
import { ModSlot } from "./mod-slot"
import { CANONICAL_POLARITIES } from "./polarity"
import type { ArcaneSlotsState } from "./use-arcane-slots"
import type { BuildSlotsState, SlotId } from "./use-build-slots"

const CANONICAL_SET = new Set<Polarity>(CANONICAL_POLARITIES)

export function toPolarity(v: string | null | undefined): Polarity | undefined {
  if (!v) return undefined
  return CANONICAL_SET.has(v as Polarity) ? (v as Polarity) : undefined
}

/**
 * Per-slot innate polarities for an item's aura slots. `item.auraPolarity`
 * may be a single polarity string (most frames) or an array (Jade: 2 slots).
 * Length always matches `count` so callers can zip by index.
 */
export function getAuraPolarities(
  item: Pick<DetailItem, "auraPolarity">,
  count: number,
): (Polarity | undefined)[] {
  const raws = Array.isArray(item.auraPolarity)
    ? item.auraPolarity
    : item.auraPolarity
      ? [item.auraPolarity]
      : []
  return Array.from({ length: count }, (_, i) => toPolarity(raws[i]))
}

/**
 * Innate exilus polarity, sourced from the `exilusPolarity` field
 * (extracted from the Warframe wiki's `Module:Weapons/data` /
 * `Module:Warframes/data` Lua tables).
 */
export function getExilusInnatePolarity(
  item: Pick<DetailItem, "exilusPolarity">,
): Polarity | undefined {
  return toPolarity(item.exilusPolarity)
}

export function getStanceInnatePolarity(
  item: Pick<DetailItem, "stancePolarity">,
): Polarity | undefined {
  return toPolarity(item.stancePolarity)
}

export function ArcaneRow({
  arcanes,
  options,
  labels,
  readOnly = false,
}: {
  arcanes: ArcaneSlotsState
  /** Per-slot picker options. Slot count = `options.length`. */
  options: Arcane[][]
  /** Optional per-slot placeholder labels. */
  labels?: string[]
  readOnly?: boolean
}) {
  return (
    <div className="flex w-full items-start justify-center gap-3 sm:gap-6">
      {options.map((slotOptions, i) => (
        <ArcaneSlot
          key={i}
          options={slotOptions}
          label={labels?.[i]}
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
  auraSlotCount,
  showExilus,
  showStance,
  slots,
  onEditRiven,
  arcaneRow,
  readOnly = false,
}: {
  item: DetailItem
  category: BrowseCategory
  isCompanion: boolean
  normalSlotCount: number
  auraSlotCount: number
  showExilus: boolean
  showStance: boolean
  slots: BuildSlotsState
  onEditRiven?: (id: SlotId) => void
  arcaneRow?: React.ReactNode
  readOnly?: boolean
}) {
  // auraPolarities stays derived here — it's not surfaced through the shared
  // BuildLayout, so there's nothing to thread it down from.
  const auraPolarities = getAuraPolarities(item, auraSlotCount)
  const polarities = item.polarities ?? []

  const slotProps = (
    id: SlotId,
    innate?: Polarity,
    options?: { disableForma?: boolean; hideDrain?: boolean },
  ) => {
    const placed = slots.placed[id]
    const forma = slots.formaPolarities[id]
    return {
      slotId: id,
      slotPolarity: innate,
      formaPolarity: forma,
      mod: placed?.mod,
      rank: placed?.rank,
      selected: slots.selected === id,
      onClick: () => slots.select(id),
      onRemove: placed ? () => slots.remove(id) : undefined,
      // Plexus Battle/Tactical slots can't be forma'd in-game; suppressing
      // the polarity picker is how the editor reflects that.
      onPickPolarity: options?.disableForma
        ? undefined
        : (p: Polarity) => slots.setForma(id, p),
      onRankChange: placed
        ? (delta: number) => slots.setRank(id, placed.rank + delta)
        : undefined,
      onEditRiven:
        placed && onEditRiven && isRivenMod(placed.mod)
          ? () => onEditRiven(id)
          : undefined,
      readOnly,
      hideDrain: options?.hideDrain ?? false,
    }
  }

  // Auto-arranging mod grid. The aura/exilus row stays centered at the top.
  // Below it, normal mods flow into a flex-wrap wrap whose max-width
  // steps up at wrap-query breakpoints, giving 2 → 3 → 4 (→ 5 for
  // companions) columns. Slots are a fixed 184px each (see mod-slot.tsx);
  // the column count is what changes, not the slot size. Buffers between
  // breakpoints leave breathing room when resizing inside a given column
  // count before the next reflow.
  // Plexus puts its aura inline at the start of the Integrated group rather
  // than in the top-of-editor aura/exilus/stance row — suppress that row
  // when we're rendering a Plexus build.
  const showTopExtrasRow =
    category !== "railjack" && (auraSlotCount > 0 || showExilus || showStance)

  return (
    <div className="flex flex-col gap-6">
      {showTopExtrasRow && (
        <div className="flex w-full flex-wrap justify-center gap-4">
          {auraSlotCount > 0 && (
            <ModSlot
              kind="aura"
              {...slotProps("aura-0" as SlotId, auraPolarities[0])}
            />
          )}
          {showStance && (
            <ModSlot
              kind="stance"
              {...slotProps("stance", getStanceInnatePolarity(item))}
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

      {category === "railjack" ? (
        // Cap at 784px so the 8 Integrated mods wrap into 4+4 rows (a
        // single row of 5 felt cramped and unbalanced against the Aura
        // slot above).
        <div className="mx-auto flex w-full max-w-[784px] flex-col gap-6">
          {(() => {
            let offset = 0
            return PLEXUS_GROUPS.map((group) => {
              const start = offset
              offset += group.count
              // Battle/Tactical are unpolarized, can't be forma'd, and don't
              // draw from the Integrated capacity pool — hide drain there too.
              const disableForma = group.kind !== "integrated"
              const hideDrain = group.kind !== "integrated"
              return (
                <div key={group.kind} className="flex flex-col gap-2">
                  <div className="text-muted-foreground/70 px-1 font-mono text-[11px] tracking-wider uppercase">
                    {group.label}
                  </div>
                  {/* gap-6 matches the gap-y-6 between wrapped mod rows so
                      the Aura → row-1 spacing reads the same as row-1 →
                      row-2 (the previous gap-2 felt cramped under Aura). */}
                  <div className="flex flex-col gap-6">
                    {/* Plexus Aura sits on its own row above the Integrated
                        mods so the section reads as Aura · row · row
                        (matches the in-game arsenal layout). */}
                    {group.kind === "integrated" && auraSlotCount > 0 && (
                      <div className="flex justify-center">
                        <ModSlot
                          kind="aura"
                          {...slotProps("aura-0" as SlotId, auraPolarities[0])}
                        />
                      </div>
                    )}
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-6">
                      {Array.from({ length: group.count }, (_, i) => {
                        const idx = start + i
                        const id: SlotId = `normal-${idx}`
                        return (
                          <ModSlot
                            key={id}
                            {...slotProps(id, toPolarity(polarities[idx]), {
                              disableForma,
                              hideDrain,
                            })}
                          />
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })
          })()}
        </div>
      ) : (
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
      )}

      {arcaneRow}
    </div>
  )
}
