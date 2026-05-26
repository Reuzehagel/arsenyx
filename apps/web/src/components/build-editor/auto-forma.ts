import type { Polarity } from "@arsenyx/shared/warframe/types"

import {
  calculateCapacity,
  effectivePolarity,
  type CapacityInput,
} from "./calculations"
import type { PlacedMod, SlotId } from "./use-build-slots"

export interface AutoFormaStep {
  id: SlotId
  polarity: Polarity
}

interface Candidate {
  id: SlotId
  innate: Polarity | undefined
  mod: PlacedMod
}

function gatherCandidates(input: CapacityInput): Candidate[] {
  const out: Candidate[] = []
  for (let i = 0; i < input.auraInnates.length; i++) {
    const id = `aura-${i}` as SlotId
    const m = input.placed[id]
    if (m) out.push({ id, innate: input.auraInnates[i], mod: m })
  }
  const exilus = input.placed.exilus
  if (exilus) {
    out.push({ id: "exilus", innate: input.exilusInnate, mod: exilus })
  }
  const stance = input.placed.stance
  if (stance) {
    out.push({ id: "stance", innate: input.stanceInnate, mod: stance })
  }
  for (let i = 0; i < input.normalInnates.length; i++) {
    const id = `normal-${i}` as SlotId
    const m = input.placed[id]
    if (!m) continue
    if (input.normalSlotConsumesDrain?.[i] === false) continue
    out.push({ id, innate: input.normalInnates[i], mod: m })
  }
  return out
}

/**
 * Greedy plan to bring `used <= max` by forma-ing slots to their placed mod's
 * polarity. Each iteration evaluates every still-eligible slot and picks the
 * one whose forma yields the largest gain in `max - used`. Stops when
 * capacity fits or no remaining slot improves it.
 *
 * Mods placed on a slot whose effective polarity already matches the mod
 * (innate or pre-existing forma) are skipped — they offer no improvement.
 * Mods with non-concrete polarity ("any", "universal") never appear in
 * practice but are guarded against.
 */
export function computeAutoFormaPlan(input: CapacityInput): AutoFormaStep[] {
  let cap = calculateCapacity(input)
  if (cap.used <= cap.max) return []

  const candidates = gatherCandidates(input)
  const plan: AutoFormaStep[] = []
  const consumed = new Set<SlotId>()
  let formaPolarities = { ...input.formaPolarities }

  while (cap.used > cap.max) {
    let best: { id: SlotId; polarity: Polarity; gain: number } | null = null
    for (const c of candidates) {
      if (consumed.has(c.id)) continue
      const modPol = c.mod.mod.polarity
      if (modPol === "any" || modPol === "universal") continue
      const eff = effectivePolarity(c.innate, formaPolarities[c.id])
      if (eff === modPol) continue
      const trial = { ...formaPolarities, [c.id]: modPol }
      const next = calculateCapacity({ ...input, formaPolarities: trial })
      const gain = next.max - next.used - (cap.max - cap.used)
      if (gain > 0 && (!best || gain > best.gain)) {
        best = { id: c.id, polarity: modPol, gain }
      }
    }
    if (!best) break
    plan.push({ id: best.id, polarity: best.polarity })
    consumed.add(best.id)
    formaPolarities = { ...formaPolarities, [best.id]: best.polarity }
    cap = calculateCapacity({ ...input, formaPolarities })
  }
  return plan
}
