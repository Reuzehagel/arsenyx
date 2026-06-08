import { useEffect, useMemo, useState } from "react"

import type { SavedVariant } from "@/lib/queries/build-query"

import type { BuildDerived, BuildLayout } from "./build-derived"
import {
  computeMultiVariantPlan,
  computeReactiveAutoFormaPlan,
  type FullAutoFormaPlan,
} from "./multi-variant-auto-forma"
import {
  dropOrphanSlots,
  type BuildSlotsState,
  type PlacedMod,
  type SlotId,
} from "./use-build-slots"

type SetVariants = (
  next: SavedVariant[] | ((prev: SavedVariant[]) => SavedVariant[]),
) => void

export interface AutoFormaPlanner {
  /** Cheap stage-1 plan, recomputed every render; null when under capacity. */
  reactiveAutoFormaPlan: FullAutoFormaPlan | null
  /** Every variant's active slot placement, for the planner + preview dialog. */
  allVariantSlots: Partial<Record<SlotId, PlacedMod>>[]
  /** Heavy plan (stages 2/3) awaiting the user's confirmation in the dialog. */
  pendingHeavyPlan: FullAutoFormaPlan | null
  dialogOpen: boolean
  onDialogOpenChange: (open: boolean) => void
  /** Briefly true after a fruitless auto-forma click (button feedback). */
  noFixFound: boolean
  /** Auto-forma button: silent apply if possible, else cascade / open preview. */
  handleAutoForma: () => void
  /** Apply the pending heavy plan (the preview dialog's confirm). */
  applyPendingPlan: () => void
}

/**
 * Owns the editor's auto-forma planning: the reactive (cheap) plan recomputed
 * each render, the heavy (stages 2/3) plan held for preview confirmation, and
 * the button/dialog handlers. Forma is build-wide in Warframe, so the planner
 * overlays the active variant's live slots onto the saved `variants[]` set and
 * considers them all together. The plan *computation* lives in
 * multi-variant-auto-forma.ts; this hook is the editor-side state + wiring.
 */
export function useAutoFormaPlanner(opts: {
  variants: SavedVariant[]
  clampedActiveIndex: number
  layout: BuildLayout
  slots: Pick<
    BuildSlotsState,
    "placed" | "formaPolarities" | "setForma" | "setPlaced"
  >
  capacity: Pick<BuildDerived["capacity"], "used" | "max">
  capacitySharedInputs: BuildDerived["capacitySharedInputs"]
  setVariants: SetVariants
}): AutoFormaPlanner {
  const {
    variants,
    clampedActiveIndex,
    layout,
    slots,
    capacity,
    capacitySharedInputs,
    setVariants,
  } = opts

  const allVariantSlots = useMemo(
    () =>
      variants.map((v, i) =>
        // The active variant's `placed` is already orphan-stripped by
        // useBuildSlots. Inactive variants come straight from the saved doc, so
        // strip them here too — otherwise a mod left in a slot this item no
        // longer has (e.g. an Exilus mod on a legacy companion-weapon build)
        // still feeds the auto-forma planner's capacity math and inflates that
        // variant's `used`, producing phantom forma recommendations.
        i === clampedActiveIndex
          ? slots.placed
          : dropOrphanSlots(v.slots ?? {}, layout),
      ),
    [variants, clampedActiveIndex, slots.placed, layout],
  )

  const reactiveAutoFormaPlan = useMemo<FullAutoFormaPlan | null>(() => {
    if (capacity.used <= capacity.max) return null
    return computeReactiveAutoFormaPlan({
      ...capacitySharedInputs,
      formaPolarities: slots.formaPolarities,
      variantSlots: allVariantSlots,
    })
  }, [
    capacity.used,
    capacity.max,
    capacitySharedInputs,
    slots.formaPolarities,
    allVariantSlots,
  ])

  const [dialogOpen, setDialogOpen] = useState(false)
  const [pendingHeavyPlan, setPendingHeavyPlan] =
    useState<FullAutoFormaPlan | null>(null)

  const applyAutoFormaPlan = (plan: FullAutoFormaPlan): void => {
    // Apply forma changes first so the active-variant capacity computation
    // sees the new polarities by the time rearrangements land.
    for (const step of plan.steps) {
      slots.setForma(step.id, step.polarity)
    }
    // Apply per-variant rearrangements: active variant goes through the
    // slots hook; the rest update the in-memory `variants[]` array directly.
    for (const arr of plan.rearrangements) {
      if (arr.variantIndex === clampedActiveIndex) {
        slots.setPlaced(arr.placed)
      } else {
        setVariants((prev) =>
          prev.map((v, i) =>
            i === arr.variantIndex ? { ...v, slots: arr.placed } : v,
          ),
        )
      }
    }
  }

  // "No fix found" feedback — flips true briefly after a fruitless click so
  // the button can hint at the result instead of looking broken. The timer
  // lives in an effect so we clear it on unmount (variant switch, route
  // change) and avoid setState on a dead component.
  const [noFixFound, setNoFixFound] = useState(false)
  useEffect(() => {
    if (!noFixFound) return
    const id = window.setTimeout(() => setNoFixFound(false), 1800)
    return () => window.clearTimeout(id)
  }, [noFixFound])

  const handleAutoForma = (): void => {
    // Fast path: reactive plan exists → silent apply. Matches the single-
    // variant UX where the button always applies forma-only improvements.
    if (reactiveAutoFormaPlan && reactiveAutoFormaPlan.steps.length > 0) {
      applyAutoFormaPlan(reactiveAutoFormaPlan)
      return
    }
    // Reactive plan empty — run the full stages 1→2→3 cascade on click.
    // Synchronous, but only at click time so it doesn't lag editing.
    const plan = computeMultiVariantPlan({
      ...capacitySharedInputs,
      formaPolarities: slots.formaPolarities,
      variantSlots: allVariantSlots,
    })
    if (!plan) {
      setNoFixFound(true)
      return
    }
    if (plan.stage === 1) {
      // Cascade found a stage-1 plan that the cheap reactive path missed
      // (different search semantics — DFS vs greedy). Apply silently.
      applyAutoFormaPlan(plan)
      return
    }
    // Stages 2/3 move user mods or burn Omni Forma — show the preview.
    setPendingHeavyPlan(plan)
    setDialogOpen(true)
  }

  const onDialogOpenChange = (open: boolean): void => {
    setDialogOpen(open)
    if (!open) setPendingHeavyPlan(null)
  }

  const applyPendingPlan = (): void => {
    if (pendingHeavyPlan) applyAutoFormaPlan(pendingHeavyPlan)
  }

  return {
    reactiveAutoFormaPlan,
    allVariantSlots,
    pendingHeavyPlan,
    dialogOpen,
    onDialogOpenChange,
    noFixFound,
    handleAutoForma,
    applyPendingPlan,
  }
}
