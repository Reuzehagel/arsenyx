import type { Polarity } from "@arsenyx/shared/warframe/types"

import type { CapacityInput } from "./calculations"
import type { PlacedMod, SlotId } from "./use-build-slots"

export interface AutoFormaStep {
  id: SlotId
  polarity: Polarity
}

export interface VariantArrangement {
  variantIndex: number
  /** New `placed` map for this variant. Only emitted when it differs from
   * the variant's input slots — variants that fit without rearrangement
   * don't appear in the plan. */
  placed: Partial<Record<SlotId, PlacedMod>>
}

/** Which escalation tier produced this plan. */
export type AutoFormaStage = 1 | 2 | 3

export interface FullAutoFormaPlan {
  stage: AutoFormaStage
  formaPolarities: Partial<Record<SlotId, Polarity>>
  /** Forma changes vs. the input's `formaPolarities` — including `"any"`
   * entries for Omni Forma slots when `stage === 3`. */
  steps: AutoFormaStep[]
  /** Per-variant mod movements. Empty for stage 1; possibly empty for
   * stages 2/3 too if formas alone suffice but the candidate set needed
   * widening. */
  rearrangements: VariantArrangement[]
  /** Number of slots forma'd to `"any"` (Omni Forma) in this plan. Only
   * non-zero for stage 3. UI surfaces this since Omni Forma is a scarcer
   * in-game resource than regular forma. */
  omniCount: number
}

/**
 * Inputs for the cross-variant forma planner. Forma is build-wide in
 * Warframe — every variant shares the same `formaPolarities`. The planner
 * searches for a single assignment that satisfies every variant's
 * `used ≤ max` constraint, choosing the assignment with the fewest formas
 * (per `calculateFormaCount`'s cross-pool dedup).
 *
 * Per-variant `placed` maps are passed as `variantSlots`; everything else
 * (innates, reactor, level cap, plexus drain mask) is shared across variants
 * and supplied once.
 */
export interface MultiVariantInput {
  variantSlots: Partial<Record<SlotId, PlacedMod>>[]
  formaPolarities: Partial<Record<SlotId, Polarity>>
  auraInnates: (Polarity | undefined)[]
  exilusInnate?: Polarity
  stanceInnate?: Polarity
  normalInnates: (Polarity | undefined)[]
  hasReactor: boolean
  maxLevelCap?: number
  /** Permanently installed exalted stance (+10 capacity). Must be forwarded
   * into every `calculateCapacity` call or the planner under-counts the
   * ceiling by 10 and recommends excess (or no) forma for exalted melees. */
  lockedStance?: PlacedMod
  normalSlotConsumesDrain?: boolean[]
}

export interface MultiVariantPlan {
  /** Forma assignment that fits every variant. */
  formaPolarities: Partial<Record<SlotId, Polarity>>
  /** Steps to apply to reach `formaPolarities` from the input's current
   * forma state. Empty when no change is needed (every variant already
   * fits). */
  steps: AutoFormaStep[]
}

/** Everything `calculateCapacity` needs that's shared across variants — i.e.
 *  not the per-variant `placed` map or the build-wide `formaPolarities`. */
export type SharedCapacityInput = Omit<
  CapacityInput,
  "placed" | "formaPolarities"
>

/** Shared iteration budget so the outer forma-combo search and the inner
 *  per-variant permutation search can't run away on the UI thread together.
 *  `count` is mutated in place across the whole search; `cap` is the ceiling. */
export interface IterBudget {
  count: number
  cap: number
}
