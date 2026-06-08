import type { Polarity } from "@arsenyx/shared/warframe/types"

import type {
  AutoFormaStage,
  AutoFormaStep,
  FullAutoFormaPlan,
  MultiVariantInput,
  VariantArrangement,
} from "./auto-forma-types"
import type { PlacedMod, SlotId } from "./use-build-slots"

/**
 * Diff two forma-polarity maps into the steps needed to go from `before` to
 * `after`. Only emits add/change steps (an `after` entry that's absent or
 * falsy is skipped — the planner never removes a forma), and counts how many
 * of those steps assign `"any"` (Omni Forma). Single source for both the
 * stage-1 plan and the stage-2/3 plan builder.
 */
export function diffFormaSteps(
  before: Partial<Record<SlotId, Polarity>>,
  after: Partial<Record<SlotId, Polarity>>,
): { steps: AutoFormaStep[]; omniCount: number } {
  const steps: AutoFormaStep[] = []
  let omniCount = 0
  const ids = new Set<SlotId>([
    ...(Object.keys(before) as SlotId[]),
    ...(Object.keys(after) as SlotId[]),
  ])
  for (const id of ids) {
    if (before[id] === after[id]) continue
    const polarity = after[id]
    if (!polarity) continue
    if (polarity === "any") omniCount++
    steps.push({ id, polarity })
  }
  return { steps, omniCount }
}

/** True iff `a` and `b` map the same SlotIds to the same mod uniqueNames.
 * Used to decide whether to emit a `VariantArrangement` (skip when no
 * effective move). */
export function arrangementEquals(
  a: Partial<Record<SlotId, PlacedMod>>,
  b: Partial<Record<SlotId, PlacedMod>>,
): boolean {
  const aIds = Object.keys(a) as SlotId[]
  const bIds = Object.keys(b) as SlotId[]
  if (aIds.length !== bIds.length) return false
  for (const id of aIds) {
    if (a[id]?.mod.uniqueName !== b[id]?.mod.uniqueName) return false
  }
  return true
}

export function planFromSearchResult(
  input: MultiVariantInput,
  stage: AutoFormaStage,
  result: {
    formaPolarities: Partial<Record<SlotId, Polarity>>
    arrangements: (Partial<Record<SlotId, PlacedMod>> | null)[]
  },
): FullAutoFormaPlan {
  const after = result.formaPolarities
  const { steps, omniCount } = diffFormaSteps(input.formaPolarities, after)
  const rearrangements: VariantArrangement[] = []
  for (let i = 0; i < input.variantSlots.length; i++) {
    const original = input.variantSlots[i]
    const arranged = result.arrangements[i] ?? original
    if (!arrangementEquals(original, arranged)) {
      rearrangements.push({ variantIndex: i, placed: arranged })
    }
  }
  return { stage, formaPolarities: after, steps, rearrangements, omniCount }
}
