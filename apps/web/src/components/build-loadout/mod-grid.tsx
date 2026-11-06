import {
  auraSlotId,
  normalSlotId,
  type PlacedArcane,
  type PlacedMod,
  type SlotId,
} from "@arsenyx/shared/warframe/build-data"
import { isRivenMod } from "@arsenyx/shared/warframe/rivens"
import type {
  Arcane,
  Polarity,
  BrowseCategory,
} from "@arsenyx/shared/warframe/types"

import { getLockedStance, type BuildLayout } from "@/lib/build/layout"
import { PLEXUS_GROUPS } from "@/lib/build/plexus"
import { getInnatePolarities } from "@/lib/build/polarities"
import type { DetailItem } from "@/lib/catalog"
import { cn } from "@/lib/util/utils"

import { ArcaneSlot } from "./arcane"
import type { ArcaneSlotsEdit, LoadoutEdit } from "./loadout-edit"
import { ModSlot } from "./mod-slot"

export function ArcaneRow({
  arcanes,
  options,
  labels,
  edit,
}: {
  arcanes: (PlacedArcane | null)[]
  /** Per-slot picker options. Slot count = `options.length`. */
  options: Arcane[][]
  labels?: string[]
  edit?: ArcaneSlotsEdit
}) {
  return (
    <div className="flex w-full items-start justify-center gap-3 sm:gap-6">
      {options.map((slotOptions, i) => (
        <ArcaneSlot
          key={i}
          options={slotOptions}
          slotIndex={i}
          label={labels?.[i]}
          placed={arcanes[i]}
          usedNames={edit?.usedNames}
          selected={edit?.selected === i}
          onSelect={() => edit?.select(i)}
          onPick={(a) => edit?.placeAt(i, a)}
          onRemove={() => edit?.remove(i)}
          onRankChange={(delta) =>
            edit?.setRank(i, (arcanes[i]?.rank ?? 0) + delta)
          }
          readOnly={!edit}
        />
      ))}
    </div>
  )
}

export function ModGrid({
  item,
  category,
  layout,
  placed,
  formaPolarities,
  edit,
  arcaneRow,
}: {
  item: DetailItem
  category: BrowseCategory
  layout: BuildLayout
  placed: Partial<Record<SlotId, PlacedMod>>
  formaPolarities: Partial<Record<SlotId, Polarity>>
  edit?: Omit<LoadoutEdit, "arcanes">
  arcaneRow?: React.ReactNode
}) {
  const { normalSlotCount, auraSlotCount, showExilus, showStance } = layout
  const innates = getInnatePolarities(item, category)
  // Exalted melees (except Garuda Talons) ship a permanently installed stance:
  // rendered locked + pre-filled, inert (no slotId → no drag/drop), and its
  // capacity comes from calculateCapacity, not from `placed`.
  const lockedStance = getLockedStance(item, category)

  // Equipped count per mod set — drives the set-bonus tier and Umbral scaling.
  const setCounts = new Map<string, number>()
  for (const p of Object.values(placed)) {
    const set = p?.mod.modSet
    if (set) setCounts.set(set, (setCounts.get(set) ?? 0) + 1)
  }

  const slotProps = (
    id: SlotId,
    innate?: Polarity,
    options?: { disableForma?: boolean; hideDrain?: boolean },
  ) => {
    const p = placed[id]
    const slots = edit?.slots
    return {
      slotId: id,
      slotPolarity: innate,
      formaPolarity: formaPolarities[id],
      mod: p?.mod,
      rank: p?.rank,
      setCount: p?.mod.modSet ? (setCounts.get(p.mod.modSet) ?? 0) : 0,
      selected: slots?.selected === id,
      alternate: p?.alternate,
      readOnly: !edit,
      hideDrain: options?.hideDrain ?? false,
      ...(slots && {
        onClick: () => slots.select(id),
        onRemove: p ? () => slots.remove(id) : undefined,
        onPickPolarity: options?.disableForma
          ? undefined
          : (pol: Polarity) => slots.setForma(id, pol),
        onRankChange: p
          ? (delta: number) => slots.setRank(id, p.rank + delta)
          : undefined,
        onEditRiven:
          p && isRivenMod(p.mod) ? () => edit.onEditRiven(id) : undefined,
        onAddAlternate: p ? () => edit.onAddAlternate(id) : undefined,
        onRemoveAlternate: p?.alternate
          ? () => slots.removeAlternate(id)
          : undefined,
      }),
    }
  }

  // Plexus puts its aura inline at the start of the Integrated group rather
  // than in the top aura/exilus/stance row.
  const showTopExtrasRow =
    category !== "railjack" && (auraSlotCount > 0 || showExilus || showStance)

  return (
    <div className="flex flex-col gap-6">
      {showTopExtrasRow && (
        <div className="flex w-full flex-wrap justify-center gap-4">
          {auraSlotCount > 0 && (
            <ModSlot
              kind="aura"
              {...slotProps(auraSlotId(0), innates.aura[0])}
            />
          )}
          {showStance &&
            (lockedStance ? (
              <ModSlot
                kind="stance"
                slotPolarity={innates.stance}
                mod={lockedStance.mod}
                rank={lockedStance.rank}
                readOnly
              />
            ) : (
              <ModSlot kind="stance" {...slotProps("stance", innates.stance)} />
            ))}
          {showExilus && (
            <ModSlot kind="exilus" {...slotProps("exilus", innates.exilus)} />
          )}
          {Array.from({ length: Math.max(0, auraSlotCount - 1) }, (_, i) => {
            const id = auraSlotId(i + 1)
            return (
              <ModSlot
                key={id}
                kind="aura"
                {...slotProps(id, innates.aura[i + 1])}
              />
            )
          })}
        </div>
      )}

      {category === "railjack" ? (
        // 784px wraps the 8 Integrated mods into 4+4 rows.
        <div className="mx-auto flex w-full max-w-[784px] flex-col gap-6">
          {(() => {
            let offset = 0
            return PLEXUS_GROUPS.map((group) => {
              const start = offset
              offset += group.count
              return (
                <div key={group.kind} className="flex flex-col gap-2">
                  <div className="text-muted-foreground/70 px-1 font-mono text-[11px] tracking-wider uppercase">
                    {group.label}
                  </div>
                  <div className="flex flex-col gap-6">
                    {/* Plexus Aura sits on its own row above the Integrated
                        mods, as in the in-game arsenal. */}
                    {group.kind === "integrated" && auraSlotCount > 0 && (
                      <div className="flex justify-center">
                        <ModSlot
                          kind="aura"
                          {...slotProps(auraSlotId(0), innates.aura[0])}
                        />
                      </div>
                    )}
                    <div className="flex flex-wrap justify-center gap-x-4 gap-y-6">
                      {Array.from({ length: group.count }, (_, i) => {
                        const idx = start + i
                        const id = normalSlotId(idx)
                        return (
                          <ModSlot
                            key={id}
                            {...slotProps(id, innates.normal[idx], {
                              disableForma: !group.formable,
                              hideDrain: !group.consumesDrain,
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
      ) : category === "operators" ? (
        // Tektolyst Artifact mods have no polarity
        // (wiki.warframe.com/w/Antique_Mods) — no Forma picker. ModCard hides
        // their drain itself.
        <div className="mx-auto flex w-full max-w-[984px] flex-col gap-2">
          <div className="text-muted-foreground/70 px-1 font-mono text-[11px] tracking-wider uppercase">
            Tektolyst Artifact
          </div>
          <div className="flex flex-wrap justify-center gap-x-4 gap-y-6">
            {Array.from({ length: normalSlotCount }, (_, i) => (
              <ModSlot
                key={i}
                {...slotProps(normalSlotId(i), undefined, {
                  disableForma: true,
                })}
              />
            ))}
          </div>
        </div>
      ) : (
        <div
          className={cn(
            // Max column count × card width + gaps; flex-wrap reflows 2→3→4
            // (→ 5 for companions' wider grid) inside one boundary.
            "mx-auto flex flex-wrap justify-center gap-x-4 gap-y-6",
            category === "companions" ? "max-w-[984px]" : "max-w-[784px]",
          )}
        >
          {Array.from({ length: normalSlotCount }, (_, i) => (
            <ModSlot
              key={i}
              {...slotProps(normalSlotId(i), innates.normal[i])}
            />
          ))}
        </div>
      )}

      {arcaneRow}
    </div>
  )
}
