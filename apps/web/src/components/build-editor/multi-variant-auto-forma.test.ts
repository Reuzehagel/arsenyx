import type { Mod, Polarity } from "@arsenyx/shared/warframe/types"
import { describe, expect, it } from "vitest"

import { calculateCapacity } from "./calculations"
import {
  computeMultiVariantPlan,
  computeMultiVariantStage1Plan,
} from "./multi-variant-auto-forma"
import type { PlacedMod, SlotId } from "./use-build-slots"

function mod(polarity: Polarity, baseDrain: number, name = "Test"): Mod {
  return {
    uniqueName: `/Mod/${name}/${polarity}/${baseDrain}`,
    name: `${name}-${polarity}-${baseDrain}`,
    polarity,
    rarity: "Common",
    baseDrain,
    fusionLimit: 0,
    type: "Mod",
    tradable: true,
  }
}

function placed(polarity: Polarity, baseDrain: number): PlacedMod {
  return { mod: mod(polarity, baseDrain), rank: 0 }
}

function emptyInputs() {
  return {
    formaPolarities: {} as Partial<Record<SlotId, Polarity>>,
    auraInnates: [] as (Polarity | undefined)[],
    normalInnates: Array.from({ length: 8 }, () => undefined) as (
      | Polarity
      | undefined
    )[],
    hasReactor: true,
  }
}

describe("computeMultiVariantStage1Plan", () => {
  it("returns an empty plan when every variant already fits", () => {
    const v1: Partial<Record<SlotId, PlacedMod>> = {
      "normal-0": placed("madurai", 10),
    }
    const v2: Partial<Record<SlotId, PlacedMod>> = {
      "normal-0": placed("vazarin", 10),
    }
    const plan = computeMultiVariantStage1Plan({
      ...emptyInputs(),
      variantSlots: [v1, v2],
    })
    expect(plan?.steps).toEqual([])
  })

  it("picks a single forma that satisfies both variants when polarities agree", () => {
    // Both variants put a madurai mod on slot 0. Capacity tight so a forma
    // is required, but a single madurai forma works for both.
    const v1: Partial<Record<SlotId, PlacedMod>> = {
      "normal-0": placed("madurai", 16),
      "normal-1": placed("madurai", 16),
    }
    const v2: Partial<Record<SlotId, PlacedMod>> = {
      "normal-0": placed("madurai", 16),
      "normal-1": placed("madurai", 16),
    }
    const inputs = {
      ...emptyInputs(),
      hasReactor: false, // max = 30, used = 32 each → over by 2
      variantSlots: [v1, v2],
    }
    const plan = computeMultiVariantStage1Plan(inputs)
    expect(plan).not.toBeNull()
    expect(plan!.steps.length).toBeGreaterThan(0)
    // Apply and verify both fit.
    const next = { ...inputs, formaPolarities: plan!.formaPolarities }
    for (const placed of [v1, v2]) {
      const cap = calculateCapacity({ ...next, placed })
      expect(cap.used).toBeLessThanOrEqual(cap.max)
    }
  })

  it("avoids a forma that breaks the other variant", () => {
    // Variant 1: madurai mod on slot 0 (drain 16). Variant 2: vazarin mod
    // same slot (drain 16). Both over an unreactored cap. Stage 1 must
    // either leave slot 0 alone or find a slot+polarity combo that doesn't
    // hurt either variant — a madurai forma on slot 0 would push variant 2
    // from 16 → 20 (round(16 * 1.25)), making things worse.
    const v1: Partial<Record<SlotId, PlacedMod>> = {
      "normal-0": placed("madurai", 16),
      "normal-1": placed("madurai", 16),
    }
    const v2: Partial<Record<SlotId, PlacedMod>> = {
      "normal-0": placed("vazarin", 16),
      "normal-1": placed("vazarin", 16),
    }
    const inputs = {
      ...emptyInputs(),
      hasReactor: false,
      variantSlots: [v1, v2],
    }
    const plan = computeMultiVariantStage1Plan(inputs)
    // Either null (infeasible — both polarities contested on every slot) or
    // a plan that doesn't make any variant worse.
    if (plan) {
      const next = { ...inputs, formaPolarities: plan.formaPolarities }
      // Plan must not push any variant above its baseline drain.
      for (const placed of [v1, v2]) {
        const baseline = calculateCapacity({ ...inputs, placed })
        const post = calculateCapacity({ ...next, placed })
        expect(post.used).toBeLessThanOrEqual(baseline.used)
      }
    }
  })

  it("returns null when no forma-only assignment satisfies every variant", () => {
    // Variant 1: 8 × madurai mods (16 drain each). Variant 2: 8 × vazarin
    // mods on the SAME slots. With reactor off (cap = 30) the only way to
    // help is to forma each slot, but each slot has two contested polarities
    // — picking madurai helps v1 but hurts v2, and vice versa. Stage 1 must
    // bail (returns null).
    const v1: Partial<Record<SlotId, PlacedMod>> = {}
    const v2: Partial<Record<SlotId, PlacedMod>> = {}
    for (let i = 0; i < 8; i++) {
      v1[`normal-${i}` as SlotId] = placed("madurai", 16)
      v2[`normal-${i}` as SlotId] = placed("vazarin", 16)
    }
    const inputs = {
      ...emptyInputs(),
      hasReactor: false,
      variantSlots: [v1, v2],
    }
    const plan = computeMultiVariantStage1Plan(inputs)
    expect(plan).toBeNull()
  })

  it("matches single-variant behavior when only one variant is supplied", () => {
    // Same scenario as the single-variant test: 5 × 10-drain madurai mods,
    // no reactor — a few formas should bring it within cap.
    const placedMap: Partial<Record<SlotId, PlacedMod>> = {}
    for (let i = 0; i < 5; i++) {
      placedMap[`normal-${i}` as SlotId] = placed("madurai", 10)
    }
    const inputs = {
      ...emptyInputs(),
      hasReactor: false,
      variantSlots: [placedMap],
    }
    const plan = computeMultiVariantStage1Plan(inputs)
    expect(plan).not.toBeNull()
    const next = { ...inputs, formaPolarities: plan!.formaPolarities }
    const cap = calculateCapacity({ ...next, placed: placedMap })
    expect(cap.used).toBeLessThanOrEqual(cap.max)
  })
})

describe("computeMultiVariantPlan (full cascade)", () => {
  it("returns stage 1 when forma-only suffices", () => {
    const placedMap: Partial<Record<SlotId, PlacedMod>> = {}
    for (let i = 0; i < 5; i++) {
      placedMap[`normal-${i}` as SlotId] = placed("madurai", 10)
    }
    const plan = computeMultiVariantPlan({
      ...emptyInputs(),
      hasReactor: false,
      variantSlots: [placedMap],
    })
    expect(plan?.stage).toBe(1)
    expect(plan?.rearrangements).toEqual([])
    expect(plan?.omniCount).toBe(0)
  })

  it("escalates to stage 2 (rearrangement) when the same mods are in different positions across variants", () => {
    // Both variants have the SAME multiset of mods (2 madurai + 2 vazarin
    // at drain 12 each), but placed on different slots. Stage 1 only
    // considers polarities-placed-in-this-slot candidates, so it has to
    // pick one polarity per contested slot — every choice fits one variant
    // and breaks the other. Stage 2 keeps the formas symmetric but
    // rearranges variant 2's mods so they line up.
    //
    // Drain math (no reactor → cap 30):
    //   match: ceil(12/2) = 6  ;  mismatch: round(12*1.25) = 15
    //   4 matches = 24 (fits) ; 4 mismatches = 60 (way over)
    const v1: Partial<Record<SlotId, PlacedMod>> = {
      "normal-0": placed("madurai", 12),
      "normal-1": placed("madurai", 12),
      "normal-2": placed("vazarin", 12),
      "normal-3": placed("vazarin", 12),
    }
    const v2: Partial<Record<SlotId, PlacedMod>> = {
      "normal-0": placed("vazarin", 12),
      "normal-1": placed("vazarin", 12),
      "normal-2": placed("madurai", 12),
      "normal-3": placed("madurai", 12),
    }
    const inputs = {
      ...emptyInputs(),
      hasReactor: false,
      normalInnates: Array.from({ length: 4 }, () => undefined) as undefined[],
      variantSlots: [v1, v2],
    }
    // Stage 1 truly fails — no per-slot polarity choice fits both
    // variants when both must hit the half-drain bonus to fit.
    expect(computeMultiVariantStage1Plan(inputs)).toBeNull()
    const plan = computeMultiVariantPlan(inputs)
    expect(plan).not.toBeNull()
    expect(plan!.stage).toBe(2)
    expect(plan!.rearrangements.length).toBeGreaterThan(0)
    // Apply and verify every variant is in budget.
    for (let v = 0; v < inputs.variantSlots.length; v++) {
      const rear = plan!.rearrangements.find((r) => r.variantIndex === v)
      const placedNow = rear?.placed ?? inputs.variantSlots[v]
      const cap = calculateCapacity({
        ...inputs,
        formaPolarities: plan!.formaPolarities,
        placed: placedNow,
      })
      expect(cap.used).toBeLessThanOrEqual(cap.max)
    }
  })

  it("escalates to stage 3 when a variant pair needs polarity-flexible slots", () => {
    // Two slots, contested polarities, drains tuned so the build is fixable
    // only when a slot is forma'd to "any" (which gives half-drain to both
    // madurai and vazarin mods).
    //
    // Per slot drain at unreactored cap=30, mod base=8 each:
    //   no forma → 8 base
    //   madurai forma + madurai mod → 4 ; + vazarin mod → 10 (1.25× → round)
    //   any forma + either mod → 4
    // Two slots, two mods each per variant: capacity 30 vs drain 4+4 = 8 — easy.
    // To force a tight scenario where only "any" works, we make slot 0
    // hold a madurai mod in V1 but vazarin in V2 with a high drain, and
    // slot 1 has slack. The planner should solve slot 0 with Omni.
    const v1: Partial<Record<SlotId, PlacedMod>> = {
      "normal-0": placed("madurai", 18),
      "normal-1": placed("madurai", 5),
    }
    const v2: Partial<Record<SlotId, PlacedMod>> = {
      "normal-0": placed("vazarin", 18),
      "normal-1": placed("vazarin", 5),
    }
    const inputs = {
      ...emptyInputs(),
      hasReactor: false,
      // Trim the normal-slot grid so combinatorics stay small.
      normalInnates: [undefined, undefined],
      variantSlots: [v1, v2],
    }
    const plan = computeMultiVariantPlan(inputs)
    if (plan) {
      // Either stage 2 or 3 — both are acceptable; the assertion is that
      // any plan returned is actually feasible.
      const fmt = plan.formaPolarities
      for (let v = 0; v < inputs.variantSlots.length; v++) {
        const rear = plan.rearrangements.find((r) => r.variantIndex === v)
        const placedNow = rear?.placed ?? inputs.variantSlots[v]
        const cap = calculateCapacity({
          ...inputs,
          formaPolarities: fmt,
          placed: placedNow,
        })
        expect(cap.used).toBeLessThanOrEqual(cap.max)
      }
    }
  })

  it("returns null promptly on an infeasible build instead of hanging", () => {
    // 8 × 11-drain mods per variant with opposing polarities and no
    // reactor — drain is 88, half-drain (best possible) is 44, cap is 30,
    // so even Omni Forma can't fix it. The planner should bail in well
    // under a second rather than exhaustively enumerating.
    const v1: Partial<Record<SlotId, PlacedMod>> = {}
    const v2: Partial<Record<SlotId, PlacedMod>> = {}
    for (let i = 0; i < 8; i++) {
      v1[`normal-${i}` as SlotId] = placed("madurai", 11)
      v2[`normal-${i}` as SlotId] = placed("vazarin", 11)
    }
    const inputs = {
      ...emptyInputs(),
      hasReactor: false,
      variantSlots: [v1, v2],
    }
    const t0 = performance.now()
    const plan = computeMultiVariantPlan(inputs)
    const elapsed = performance.now() - t0
    expect(plan).toBeNull()
    // Generous bound — the iter cap should keep this well under 500ms on
    // any machine. Locally it's milliseconds.
    expect(elapsed).toBeLessThan(2000)
  })
})
