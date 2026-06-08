import type { Polarity } from "@arsenyx/shared/warframe/types"

import {
  applyCandidate,
  gatherKindCandidates,
  gatherSlotSpecs,
  listFormaCandidates,
  type FormaSlotChoice,
} from "./auto-forma-candidates"
import { combinationsOfK } from "./auto-forma-combinatorics"
import { tryArrangeVariant } from "./auto-forma-greedy"
import { diffFormaSteps, planFromSearchResult } from "./auto-forma-steps"
import type {
  AutoFormaStage,
  AutoFormaStep,
  FullAutoFormaPlan,
  IterBudget,
  MultiVariantInput,
  MultiVariantPlan,
  SharedCapacityInput,
} from "./auto-forma-types"
import { calculateCapacity, calculateFormaCount } from "./calculations"
import type { PlacedMod, SlotId } from "./use-build-slots"

// Public surface — keep existing `from "./multi-variant-auto-forma"` imports
// (editor-shell, auto-forma-dialog, the test) working after the split.
export type {
  AutoFormaStage,
  AutoFormaStep,
  FullAutoFormaPlan,
  MultiVariantInput,
  MultiVariantPlan,
  VariantArrangement,
} from "./auto-forma-types"
// Re-export the local binding (imported above for internal use) so the test's
// `import { listFormaCandidates } from "./multi-variant-auto-forma"` keeps working.
export { listFormaCandidates }

function sharedFrom(input: MultiVariantInput): SharedCapacityInput {
  return {
    auraInnates: input.auraInnates,
    exilusInnate: input.exilusInnate,
    stanceInnate: input.stanceInnate,
    normalInnates: input.normalInnates,
    hasReactor: input.hasReactor,
    maxLevelCap: input.maxLevelCap,
    lockedStance: input.lockedStance,
    normalSlotConsumesDrain: input.normalSlotConsumesDrain,
  }
}

function isFeasible(
  variantSlots: Partial<Record<SlotId, PlacedMod>>[],
  shared: SharedCapacityInput,
  formaPolarities: Partial<Record<SlotId, Polarity>>,
): boolean {
  for (const placed of variantSlots) {
    const cap = calculateCapacity({ ...shared, placed, formaPolarities })
    if (cap.used > cap.max) return false
  }
  return true
}

/**
 * Stage 1 of multi-variant auto-forma: forma-only, no mod rearrangement, no
 * Omni Forma. Returns `null` when no forma-only assignment satisfies every
 * variant — callers escalate to stage 2 (rearrangement) and stage 3 (Omni)
 * in that case.
 *
 * Search: bounded DFS over slot×candidate combinations, ordered by slot
 * weight (heaviest first). The candidate set per slot is restricted to
 * `{current state}` ∪ `{polarities placed in that slot across variants}` —
 * any other polarity wastes a forma without helping any variant.
 *
 * Tie-breaker among feasible assignments is `calculateFormaCount` (cross-
 * pool dedup), so the planner naturally prefers reusing existing formas
 * over adding new ones.
 */
export function computeMultiVariantStage1Plan(
  input: MultiVariantInput,
): MultiVariantPlan | null {
  const shared = sharedFrom(input)

  // Already feasible? Return an empty plan — but only signal that to the UI
  // when caller asked: the EditorShell still hides the button when active
  // variant fits.
  if (isFeasible(input.variantSlots, shared, input.formaPolarities)) {
    // Defensive copy — callers shouldn't be able to mutate the editor's
    // forma map by reaching into the returned plan.
    return { formaPolarities: { ...input.formaPolarities }, steps: [] }
  }

  const specs = gatherSlotSpecs(input)
  if (specs.length === 0) return null

  const cur: Partial<Record<SlotId, Polarity>> = { ...input.formaPolarities }
  let best: {
    formas: Partial<Record<SlotId, Polarity>>
    count: number
  } | null = null
  // Hard cap on DFS iterations as a runaway safeguard. Realistic builds
  // have ≤ 10 contested slots with 2–3 candidates each, well under this.
  const ITER_CAP = 200_000
  let iters = 0

  function dfs(idx: number): boolean {
    if (iters++ > ITER_CAP) return false
    if (idx === specs.length) {
      if (!isFeasible(input.variantSlots, shared, cur)) return true
      const count = calculateFormaCount({
        auraInnates: input.auraInnates,
        exilusInnate: input.exilusInnate,
        stanceInnate: input.stanceInnate,
        normalInnates: input.normalInnates,
        formaPolarities: cur,
      })
      if (!best || count < best.count) {
        best = { formas: { ...cur }, count }
      }
      return true
    }
    const { id, candidates } = specs[idx]
    const original = cur[id]
    for (const cand of candidates) {
      applyCandidate(cur, id, cand)
      if (!dfs(idx + 1)) {
        // Iteration cap hit — bail out of recursion entirely.
        if (original === undefined) delete cur[id]
        else cur[id] = original
        return false
      }
    }
    if (original === undefined) delete cur[id]
    else cur[id] = original
    return true
  }

  dfs(0)
  if (!best) return null

  // TS can't carry the closure mutation through to here, so assert.
  const bestFormas = (best as { formas: Partial<Record<SlotId, Polarity>> })
    .formas
  // Stage 1 only adds/changes formas, never removes — diffFormaSteps drops
  // any `after === undefined` entry, and the search space only produces
  // `"__none__"` for slots that started without a forma anyway.
  const { steps } = diffFormaSteps(input.formaPolarities, bestFormas)

  return { formaPolarities: bestFormas, steps }
}

// ─── Stage 2 & 3: rearrangement (+ optional Omni Forma) ────────────────────
//
// When stage 1 returns null no single forma assignment satisfies every
// variant with the mods sitting where they currently are. Stage 2 widens
// the candidate polarity set per slot (any normal-slot mod could move into
// any normal slot, so any normal-eligible polarity is a sensible forma
// candidate), and re-checks feasibility allowing per-variant mod
// permutation among the normal slots. Stage 3 additionally allows `"any"`
// (Omni Forma) in candidates — strictly more powerful, but Omni Forma is
// a rarer in-game resource so we only escalate when stage 2 fails.
//
// The outer search is iterative-deepening on forma count: try k = 0 new
// formas, then 1, then 2, … . First feasible k wins. Inner per-variant
// "can these mods fit these polarities?" is solved by bounded permutation
// search with early exit on first feasible permutation (see auto-forma-greedy).

/** Try `k` new formas drawn from `candidates`. Returns the first feasible
 * plan (forma assignment + per-variant arrangements) or `null` if none. */
function searchWithKNewFormas(
  input: MultiVariantInput,
  candidates: FormaSlotChoice[],
  k: number,
  budget: IterBudget,
): {
  formaPolarities: Partial<Record<SlotId, Polarity>>
  arrangements: (Partial<Record<SlotId, PlacedMod>> | null)[]
} | null {
  const shared = sharedFrom(input)
  const tryCombo = (
    combo: FormaSlotChoice[],
  ): {
    formaPolarities: Partial<Record<SlotId, Polarity>>
    arrangements: (Partial<Record<SlotId, PlacedMod>> | null)[]
  } | null => {
    if (budget.count++ > budget.cap) return null
    // Reject combos that target the same slot twice.
    const seen = new Set<SlotId>()
    for (const c of combo) {
      if (seen.has(c.id)) return null
      seen.add(c.id)
    }
    const trial: Partial<Record<SlotId, Polarity>> = {
      ...input.formaPolarities,
    }
    for (const c of combo) trial[c.id] = c.polarity
    const arrangements: (Partial<Record<SlotId, PlacedMod>> | null)[] = []
    for (const placed of input.variantSlots) {
      const arr = tryArrangeVariant(placed, shared, trial, budget)
      if (!arr) return null
      arrangements.push(arr)
    }
    return { formaPolarities: trial, arrangements }
  }
  if (k === 0) return tryCombo([])
  for (const combo of combinationsOfK(candidates, k)) {
    if (budget.count > budget.cap) return null
    const r = tryCombo(combo)
    if (r) return r
  }
  return null
}

/**
 * Stage 2 / 3 search. `allowOmni: false` is stage 2 (regular forma +
 * rearrangement only). `allowOmni: true` is stage 3 (also lets a slot be
 * forma'd to `"any"` polarity, modeling Omni Forma).
 *
 * Iterative deepening on the number of new formas added to the existing
 * `formaPolarities`. First feasible k wins. The hard iteration cap (5M)
 * keeps a pathological input from locking the UI; in realistic builds
 * stage 2 finishes in k ≤ 3 well under the cap.
 */
function searchWithRearrangement(
  input: MultiVariantInput,
  allowOmni: boolean,
): FullAutoFormaPlan | null {
  const buckets = gatherKindCandidates(input, allowOmni)
  const candidates = listFormaCandidates(input, buckets)
  const stage: AutoFormaStage = allowOmni ? 3 : 2
  // Single shared budget across the outer forma-combo search and the inner
  // per-variant permutation search. 50k operations covers realistic builds
  // (≤ 6 mods per variant, ≤ 3 variants); pathological inputs return null
  // in well under a frame instead of locking the editor on click.
  const budget: IterBudget = { count: 0, cap: 50_000 }
  // Cap on the number of new formas we're willing to add. 5 is more than
  // any realistic Warframe build needs (most peak at 3); higher values
  // explode the combination space without practical benefit.
  const MAX_K = Math.min(candidates.length, 5)
  for (let k = 0; k <= MAX_K; k++) {
    if (budget.count > budget.cap) return null
    const r = searchWithKNewFormas(input, candidates, k, budget)
    if (r) {
      const plan = planFromSearchResult(input, stage, r)
      // For stage 3, only accept the plan if it actually uses Omni — if
      // it doesn't, the same answer would have appeared in stage 2 (we
      // explored a strict superset there). Demote so the dialog shows
      // the right callout.
      if (allowOmni && plan.omniCount === 0) {
        return { ...plan, stage: 2 }
      }
      return plan
    }
  }
  return null
}

/**
 * Greedy partial-fix fallback. Walks slot-by-slot, applies the single best
 * forma that improves the worst variant's headroom without making any
 * other variant worse, repeating until no slot helps. May return a plan
 * that *improves* capacity without fully fitting it — matches the original
 * single-variant auto-forma's UX, where the button shipped any reduction.
 *
 * O(slots² × variants × placed-mods) per slot examined, no permutation —
 * safe to call on every render even for heavy builds.
 */
function computeBestEffortPlan(
  input: MultiVariantInput,
): FullAutoFormaPlan | null {
  const shared = sharedFrom(input)
  const formaPolarities: Partial<Record<SlotId, Polarity>> = {
    ...input.formaPolarities,
  }
  const headroom = () => {
    let worst = Infinity
    for (const placed of input.variantSlots) {
      const cap = calculateCapacity({ ...shared, placed, formaPolarities })
      const h = cap.max - cap.used
      if (h < worst) worst = h
    }
    return worst
  }
  const baseline = headroom()
  if (baseline >= 0) return null // already fits

  const steps: AutoFormaStep[] = []
  // Per-variant baseline headroom — used to reject formas that make some
  // other variant worse than it started.
  const initialHeadrooms = input.variantSlots.map((placed) => {
    const cap = calculateCapacity({
      ...shared,
      placed,
      formaPolarities: input.formaPolarities,
    })
    return cap.max - cap.used
  })

  // Cap iterations to keep this strictly fast on the reactive path.
  for (let pass = 0; pass < 12; pass++) {
    const current = headroom()
    if (current >= 0) break
    let best: { id: SlotId; polarity: Polarity; headroom: number } | null = null
    // Consider forma-ing each placed mod's slot to its own polarity. Loop
    // is O(variants × placed) and the trial capacity computation per
    // candidate is cheap.
    for (let v = 0; v < input.variantSlots.length; v++) {
      for (const [rawId, mod] of Object.entries(input.variantSlots[v])) {
        if (!mod) continue
        const modPol = mod.mod.polarity
        if (modPol === "any" || modPol === "universal") continue
        const id = rawId as SlotId
        if (formaPolarities[id] === modPol) continue
        const trial: Partial<Record<SlotId, Polarity>> = {
          ...formaPolarities,
          [id]: modPol,
        }
        // Reject if any variant gets worse than its starting baseline.
        let acceptable = true
        let trialHeadroom = Infinity
        for (let i = 0; i < input.variantSlots.length; i++) {
          const cap = calculateCapacity({
            ...shared,
            placed: input.variantSlots[i],
            formaPolarities: trial,
          })
          const h = cap.max - cap.used
          if (h < initialHeadrooms[i]) {
            acceptable = false
            break
          }
          if (h < trialHeadroom) trialHeadroom = h
        }
        if (!acceptable) continue
        if (trialHeadroom <= current) continue
        if (!best || trialHeadroom > best.headroom) {
          best = { id, polarity: modPol, headroom: trialHeadroom }
        }
      }
    }
    if (!best) break
    formaPolarities[best.id] = best.polarity
    steps.push({ id: best.id, polarity: best.polarity })
  }

  if (steps.length === 0) return null
  return {
    stage: 1,
    formaPolarities,
    steps,
    rearrangements: [],
    omniCount: 0,
  }
}

/**
 * Cheap reactive plan — runs stage 1 (exhaustive forma-only fit) first,
 * falls back to a greedy partial fix if no full fit is possible. Safe to
 * call on every render. Use `computeMultiVariantPlan` for the full
 * stages 1→2→3 cascade (slow, only call on user click).
 */
export function computeReactiveAutoFormaPlan(
  input: MultiVariantInput,
): FullAutoFormaPlan | null {
  const s1 = computeMultiVariantStage1Plan(input)
  if (s1 && s1.steps.length > 0) {
    return {
      stage: 1,
      formaPolarities: s1.formaPolarities,
      steps: s1.steps,
      rearrangements: [],
      omniCount: 0,
    }
  }
  // Stage 1 may have returned an empty-steps plan ("already feasible") —
  // in that case we shouldn't fall back to best-effort.
  if (s1) return null
  return computeBestEffortPlan(input)
}

/**
 * Full stages 1 → 2 → 3 cascade. Slow on infeasible inputs (up to a few
 * hundred ms even with bounded search), so only invoke on a user click
 * — not on every reactive render.
 *
 * Returns `null` when even Omni Forma can't make every variant fit
 * (rare — usually a build that's fundamentally over capacity even with
 * full half-drain bonuses everywhere).
 */
export function computeMultiVariantPlan(
  input: MultiVariantInput,
): FullAutoFormaPlan | null {
  const s1 = computeMultiVariantStage1Plan(input)
  if (s1) {
    return {
      stage: 1,
      formaPolarities: s1.formaPolarities,
      steps: s1.steps,
      rearrangements: [],
      omniCount: 0,
    }
  }
  const s2 = searchWithRearrangement(input, false)
  if (s2) return s2
  return searchWithRearrangement(input, true)
}
