import type { Polarity } from "@arsenyx/shared/warframe/types"

import {
  calculateCapacity,
  calculateFormaCount,
  effectivePolarity,
  type CapacityInput,
} from "./calculations"
import { slotKind, type PlacedMod, type SlotId } from "./use-build-slots"

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

type SlotCandidate = Polarity | "__none__"

function sharedFrom(
  input: MultiVariantInput,
): Omit<CapacityInput, "placed" | "formaPolarities"> {
  return {
    auraInnates: input.auraInnates,
    exilusInnate: input.exilusInnate,
    stanceInnate: input.stanceInnate,
    normalInnates: input.normalInnates,
    hasReactor: input.hasReactor,
    maxLevelCap: input.maxLevelCap,
    normalSlotConsumesDrain: input.normalSlotConsumesDrain,
  }
}

function isFeasible(
  variantSlots: Partial<Record<SlotId, PlacedMod>>[],
  shared: Omit<CapacityInput, "placed" | "formaPolarities">,
  formaPolarities: Partial<Record<SlotId, Polarity>>,
): boolean {
  for (const placed of variantSlots) {
    const cap = calculateCapacity({ ...shared, placed, formaPolarities })
    if (cap.used > cap.max) return false
  }
  return true
}

interface SlotSpec {
  id: SlotId
  candidates: SlotCandidate[]
  /** Max single-variant base drain among mods placed in this slot. Used to
   * order slots heaviest-first so the search picks high-impact branches
   * before trivial ones. */
  weight: number
}

function gatherSlotSpecs(input: MultiVariantInput): SlotSpec[] {
  // Collect distinct mod polarities placed in each slot across all variants,
  // plus the heaviest mod's drain for ordering.
  const slotPolarities = new Map<SlotId, Set<Polarity>>()
  const slotWeights = new Map<SlotId, number>()
  for (const placed of input.variantSlots) {
    for (const [rawId, mod] of Object.entries(placed)) {
      if (!mod) continue
      const id = rawId as SlotId
      const p = mod.mod.polarity
      if (p !== "any" && p !== "universal") {
        if (!slotPolarities.has(id)) slotPolarities.set(id, new Set())
        slotPolarities.get(id)!.add(p)
      }
      const drain = Math.abs(mod.mod.baseDrain) + mod.rank
      const prev = slotWeights.get(id) ?? 0
      if (drain > prev) slotWeights.set(id, drain)
    }
  }
  const specs: SlotSpec[] = []
  for (const [id, polSet] of slotPolarities) {
    const current = input.formaPolarities[id]
    const candidates = new Set<SlotCandidate>()
    candidates.add(current ?? "__none__")
    for (const p of polSet) candidates.add(p)
    // Slots whose only candidate is the existing state contribute nothing —
    // skip them so the DFS doesn't waste a recursion level.
    if (candidates.size > 1) {
      specs.push({
        id,
        candidates: [...candidates],
        weight: slotWeights.get(id) ?? 0,
      })
    }
  }
  // Heaviest first.
  specs.sort((a, b) => b.weight - a.weight)
  return specs
}

function applyCandidate(
  formaPolarities: Partial<Record<SlotId, Polarity>>,
  id: SlotId,
  cand: SlotCandidate,
): void {
  if (cand === "__none__") delete formaPolarities[id]
  else formaPolarities[id] = cand
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
  const steps: AutoFormaStep[] = []
  const ids = new Set<SlotId>([
    ...(Object.keys(input.formaPolarities) as SlotId[]),
    ...(Object.keys(bestFormas) as SlotId[]),
  ])
  for (const id of ids) {
    const before = input.formaPolarities[id]
    const after = bestFormas[id]
    if (before === after) continue
    // Stage 1 only adds/changes formas, never removes — bestFormas comes
    // from the search space we just walked, where "__none__" only appears
    // for slots that started without a forma, so `after === undefined`
    // implies `before === undefined` and we wouldn't reach this branch.
    if (after) steps.push({ id, polarity: after })
  }

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
// search with early exit on first feasible permutation.

// Lazy permutation/combination generators — produce one tuple at a time so
// the caller can early-exit on a feasibility hit without materializing the
// whole space. (Materializing C(20, 8) = 125k tuples and discarding them
// after the first match was the source of an early hang.)
function* permutationsOf<T>(arr: T[]): Generator<T[]> {
  if (arr.length === 0) {
    yield []
    return
  }
  for (let i = 0; i < arr.length; i++) {
    const rest = [...arr.slice(0, i), ...arr.slice(i + 1)]
    for (const sub of permutationsOf(rest)) {
      yield [arr[i], ...sub]
    }
  }
}

function* combinationsOfK<T>(arr: T[], k: number): Generator<T[]> {
  if (k === 0) {
    yield []
    return
  }
  if (arr.length < k) return
  if (arr.length === k) {
    yield [...arr]
    return
  }
  const [head, ...tail] = arr
  for (const c of combinationsOfK(tail, k - 1)) yield [head, ...c]
  yield* combinationsOfK(tail, k)
}

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
interface IterBudget {
  count: number
  cap: number
}

function tryArrangeVariant(
  placed: Partial<Record<SlotId, PlacedMod>>,
  shared: Omit<CapacityInput, "placed" | "formaPolarities">,
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
  // polarity in WFCD data but defend against it anyway.
  const indicesByPol = new Map<Polarity, number[]>()
  for (let i = 0; i < mods.length; i++) {
    const p = mods[i].mod.polarity
    if (p === "any" || p === "universal") continue
    if (!indicesByPol.has(p)) indicesByPol.set(p, [])
    indicesByPol.get(p)!.push(i)
  }
  const drainOf = (i: number): number =>
    Math.abs(mods[i].mod.baseDrain) + mods[i].rank
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

/** True iff `a` and `b` map the same SlotIds to the same mod uniqueNames.
 * Used to decide whether to emit a `VariantArrangement` (skip when no
 * effective move). */
function arrangementEquals(
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

interface KindCandidates {
  aura: Polarity[]
  exilus: Polarity[]
  stance: Polarity[]
  normal: Polarity[]
}

function gatherKindCandidates(
  input: MultiVariantInput,
  allowOmni: boolean,
): KindCandidates {
  const buckets: KindCandidates = {
    aura: [],
    exilus: [],
    stance: [],
    normal: [],
  }
  const seen: { [K in keyof KindCandidates]: Set<Polarity> } = {
    aura: new Set(),
    exilus: new Set(),
    stance: new Set(),
    normal: new Set(),
  }
  for (const placed of input.variantSlots) {
    for (const [rawId, mod] of Object.entries(placed)) {
      if (!mod) continue
      const p = mod.mod.polarity
      if (p === "any" || p === "universal") continue
      const kind = slotKind(rawId as SlotId)
      if (!seen[kind].has(p)) {
        seen[kind].add(p)
        buckets[kind].push(p)
      }
    }
  }
  if (allowOmni) {
    for (const k of ["aura", "exilus", "stance", "normal"] as const) {
      buckets[k].push("any")
    }
  }
  return buckets
}

interface FormaSlotChoice {
  id: SlotId
  polarity: Polarity
}

function listFormaCandidates(
  input: MultiVariantInput,
  buckets: KindCandidates,
): FormaSlotChoice[] {
  // Per slot, the polarity choices that could plausibly help. Skip slots
  // whose effective polarity is already covered by the variant's mod in
  // every variant — they don't need forma. (Stage 2's broader candidate
  // set means we include more slots than stage 1 did, since rearrangement
  // can route any normal-eligible mod through any normal slot.)
  const out: FormaSlotChoice[] = []
  for (let i = 0; i < input.auraInnates.length; i++) {
    const id = `aura-${i}` as SlotId
    for (const p of buckets.aura) {
      if (input.formaPolarities[id] === p) continue
      out.push({ id, polarity: p })
    }
  }
  if (input.exilusInnate !== undefined || hasExilusSlotLike(input)) {
    for (const p of buckets.exilus) {
      if (input.formaPolarities.exilus === p) continue
      out.push({ id: "exilus", polarity: p })
    }
  }
  if (input.stanceInnate !== undefined || hasStanceSlotLike(input)) {
    for (const p of buckets.stance) {
      if (input.formaPolarities.stance === p) continue
      out.push({ id: "stance", polarity: p })
    }
  }
  for (let i = 0; i < input.normalInnates.length; i++) {
    if (input.normalSlotConsumesDrain?.[i] === false) continue
    const id = `normal-${i}` as SlotId
    for (const p of buckets.normal) {
      if (input.formaPolarities[id] === p) continue
      out.push({ id, polarity: p })
    }
  }
  return out
}

/** True iff any variant has a mod in the exilus slot. (Innate polarity
 * info doesn't propagate item type, but the presence of a mod confirms
 * the slot is available.) */
function hasExilusSlotLike(input: MultiVariantInput): boolean {
  for (const placed of input.variantSlots) {
    if (placed.exilus) return true
  }
  return false
}
function hasStanceSlotLike(input: MultiVariantInput): boolean {
  for (const placed of input.variantSlots) {
    if (placed.stance) return true
  }
  return false
}

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

function planFromSearchResult(
  input: MultiVariantInput,
  stage: AutoFormaStage,
  result: {
    formaPolarities: Partial<Record<SlotId, Polarity>>
    arrangements: (Partial<Record<SlotId, PlacedMod>> | null)[]
  },
): FullAutoFormaPlan {
  const before = input.formaPolarities
  const after = result.formaPolarities
  const steps: AutoFormaStep[] = []
  const ids = new Set<SlotId>([
    ...(Object.keys(before) as SlotId[]),
    ...(Object.keys(after) as SlotId[]),
  ])
  let omniCount = 0
  for (const id of ids) {
    if (before[id] === after[id]) continue
    const polarity = after[id]
    if (!polarity) continue
    if (polarity === "any") omniCount++
    steps.push({ id, polarity })
  }
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
