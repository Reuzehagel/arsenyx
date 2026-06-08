import type { Polarity } from "@arsenyx/shared/warframe/types"

import { combinationsOfK, permutationsOf } from "./auto-forma-combinatorics"
import type { IterBudget, SharedCapacityInput } from "./auto-forma-types"
import {
  baseDrainForMod,
  calculateCapacity,
  effectivePolarity,
} from "./calculations"
import { slotKind, type PlacedMod, type SlotId } from "./use-build-slots"

/**
 * Given a single variant and a candidate `formaPolarities`, find a
 * rearrangement of the variant's NORMAL-slot mods that brings it under
 * capacity. Returns the (possibly unchanged) placed map, or `null` if no
 * normal-slot permutation works.
 *
 * Aura / exilus / stance / Plexus-tactical slots are kept in place —
 * cross-kind movement is out of scope (per design discussion). The variant
 * is returned unchanged if it already fits.
 */
export function tryArrangeVariant(
  placed: Partial<Record<SlotId, PlacedMod>>,
  shared: SharedCapacityInput,
  formaPolarities: Partial<Record<SlotId, Polarity>>,
  budget: IterBudget,
): Partial<Record<SlotId, PlacedMod>> | null {
  const cap = calculateCapacity({ ...shared, placed, formaPolarities })
  if (cap.used <= cap.max) return placed

  // Gather currently-occupied normal slots (the mods we can shuffle) and
  // the full pool of legal normal-slot destinations (including currently-
  // empty slots whose innate polarity might help).
  const movedMods: PlacedMod[] = []
  const sourceSlots: SlotId[] = []
  const destSlots: SlotId[] = []
  for (let i = 0; i < shared.normalInnates.length; i++) {
    const id = `normal-${i}` as SlotId
    if (shared.normalSlotConsumesDrain?.[i] === false) continue
    destSlots.push(id)
    const m = placed[id]
    if (m) {
      movedMods.push(m)
      sourceSlots.push(id)
    }
  }
  if (movedMods.length <= 1) return null
  // Pinned (non-normal) entries that don't participate in rearrangement.
  const pinned: Partial<Record<SlotId, PlacedMod>> = {}
  for (const [id, mod] of Object.entries(placed)) {
    if (slotKind(id as SlotId) !== "normal") pinned[id as SlotId] = mod
  }
  // Also keep mods in normal-but-not-rearrangeable slots (e.g., plexus
  // tactical/battle slots whose drain is excluded). Currently
  // `destSlots`/`movedMods` skip these via the drain-consumes mask above,
  // but the placement itself stays where it is.
  for (let i = 0; i < shared.normalInnates.length; i++) {
    if (shared.normalSlotConsumesDrain?.[i] === false) {
      const id = `normal-${i}` as SlotId
      if (placed[id]) pinned[id] = placed[id]
    }
  }

  // Greedy assignment by polarity. O(n²) instead of brute-force O(n!), which
  // matters because we run this once per outer forma combo: an exhaustive
  // permutation search at n = 8 (40k tuples × multiple variants × thousands
  // of forma combos) starves the iter budget before finding a real plan.
  //
  // The matching is in three passes:
  //   1. Same-polarity slots take their heaviest matching mod (max savings).
  //   2. "Any"-polarity slots take the heaviest remaining non-umbra mod
  //      (half drain via Omni/any).
  //   3. Remaining slots get whatever's left; lightest mods go to mismatched
  //      slots so the 1.25× penalty hits the smallest base drains.
  // Polarity-distribution-pathological cases (e.g., 5 madurai mods, 2
  // madurai slots, the heaviest can't reach one) are missed by greedy but
  // are rare in practice. If feasibility check fails we fall back to the
  // bounded permutation search below.
  const innateForSlotIndex = (sid: SlotId): Polarity | undefined => {
    const m = /^normal-(\d+)$/.exec(sid)
    if (m) return shared.normalInnates[Number(m[1])]
    return undefined
  }
  budget.count++
  if (budget.count > budget.cap) return null
  const greedyAttempt = arrangeNormalsGreedy(
    movedMods,
    destSlots,
    pinned,
    formaPolarities,
    innateForSlotIndex,
  )
  if (greedyAttempt) {
    const gcap = calculateCapacity({
      ...shared,
      placed: greedyAttempt,
      formaPolarities,
    })
    if (gcap.used <= gcap.max) return greedyAttempt
  }
  // Fallback: bounded permutation. Very small problems (≤ 5 mods) escape
  // greedy's blind spots cheaply; bigger ones blow the budget and bail.
  if (movedMods.length > 5) return null
  for (const slotChoice of combinationsOfK(destSlots, movedMods.length)) {
    for (const modPerm of permutationsOf(movedMods)) {
      if (budget.count++ > budget.cap) return null
      const trial: Partial<Record<SlotId, PlacedMod>> = { ...pinned }
      for (let i = 0; i < slotChoice.length; i++) {
        trial[slotChoice[i]] = modPerm[i]
      }
      const tcap = calculateCapacity({
        ...shared,
        placed: trial,
        formaPolarities,
      })
      if (tcap.used <= tcap.max) return trial
    }
  }
  return null
}

/** Greedy mod-to-slot assignment by polarity. Returns a placed map (mods
 * routed to chosen destSlots, pinned mods preserved). Doesn't verify the
 * result fits capacity — caller does that. */
function arrangeNormalsGreedy(
  mods: PlacedMod[],
  destSlots: SlotId[],
  pinned: Partial<Record<SlotId, PlacedMod>>,
  formaPolarities: Partial<Record<SlotId, Polarity>>,
  innateForSlot: (id: SlotId) => Polarity | undefined,
): Partial<Record<SlotId, PlacedMod>> | null {
  if (mods.length > destSlots.length) return null
  const slotPols = destSlots.map((id) => ({
    id,
    eff: effectivePolarity(innateForSlot(id), formaPolarities[id]),
  }))
  const usedSlot = new Set<SlotId>()
  const usedMod = new Set<number>()
  const out: Partial<Record<SlotId, PlacedMod>> = { ...pinned }
  // Mod indices grouped by polarity, kept as candidate lists for the
  // greedy passes. Skip "any"/"universal" — neither appears as a mod
  // polarity in the mod data but defend against it anyway.
  const indicesByPol = new Map<Polarity, number[]>()
  for (let i = 0; i < mods.length; i++) {
    const p = mods[i].mod.polarity
    if (p === "any" || p === "universal") continue
    if (!indicesByPol.has(p)) indicesByPol.set(p, [])
    indicesByPol.get(p)!.push(i)
  }
  const drainOf = (i: number): number =>
    Math.abs(baseDrainForMod(mods[i].mod, mods[i].rank))
  const takeHeaviest = (candidates: number[]): number | null => {
    let bestIdx = -1
    let bestD = -1
    for (const ci of candidates) {
      if (usedMod.has(ci)) continue
      const d = drainOf(ci)
      if (d > bestD) {
        bestD = d
        bestIdx = ci
      }
    }
    return bestIdx >= 0 ? bestIdx : null
  }
  // Pass 1: exact polarity matches — heaviest mod of matching polarity
  // takes the matching slot (biggest half-drain savings).
  for (const slot of slotPols) {
    if (
      !slot.eff ||
      slot.eff === "any" ||
      slot.eff === "universal" ||
      usedSlot.has(slot.id)
    )
      continue
    const cands = indicesByPol.get(slot.eff)
    if (!cands) continue
    const pick = takeHeaviest(cands)
    if (pick === null) continue
    out[slot.id] = mods[pick]
    usedSlot.add(slot.id)
    usedMod.add(pick)
  }
  // Pass 2: "any" slots take the heaviest remaining non-umbra mod (any
  // gives half drain to any non-umbra polarity).
  const allIndices = mods.map((_, i) => i)
  for (const slot of slotPols) {
    if (slot.eff !== "any" || usedSlot.has(slot.id)) continue
    const nonUmbra = allIndices.filter(
      (i) => !usedMod.has(i) && mods[i].mod.polarity !== "umbra",
    )
    const pick = takeHeaviest(nonUmbra)
    if (pick === null) continue
    out[slot.id] = mods[pick]
    usedSlot.add(slot.id)
    usedMod.add(pick)
  }
  // Pass 3: no-polarity / universal slots get heaviest remaining (base drain).
  for (const slot of slotPols) {
    if (slot.eff && slot.eff !== "universal") continue
    if (usedSlot.has(slot.id)) continue
    const remaining = allIndices.filter((i) => !usedMod.has(i))
    if (remaining.length === 0) break
    const pick = takeHeaviest(remaining)
    if (pick === null) break
    out[slot.id] = mods[pick]
    usedSlot.add(slot.id)
    usedMod.add(pick)
  }
  // Pass 4: mismatched slots take lightest remaining (1.25× hits the
  // smallest base drain).
  for (const slot of slotPols) {
    if (usedSlot.has(slot.id)) continue
    let lightest = -1
    let lightestD = Infinity
    for (let i = 0; i < mods.length; i++) {
      if (usedMod.has(i)) continue
      const d = drainOf(i)
      if (d < lightestD) {
        lightestD = d
        lightest = i
      }
    }
    if (lightest < 0) break
    out[slot.id] = mods[lightest]
    usedSlot.add(slot.id)
    usedMod.add(lightest)
  }
  // Every mod must be placed somewhere — if greedy couldn't, signal failure.
  if (usedMod.size !== mods.length) return null
  return out
}
