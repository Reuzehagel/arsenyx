import type { Polarity } from "@arsenyx/shared/warframe/types"

import type { MultiVariantInput } from "./auto-forma-types"
import { baseDrainForMod } from "./calculations"
import { slotKind, type SlotId } from "./use-build-slots"

// ─── Stage 1 candidates: per-slot polarity choices ─────────────────────────

export type SlotCandidate = Polarity | "__none__"

export interface SlotSpec {
  id: SlotId
  candidates: SlotCandidate[]
  /** Max single-variant base drain among mods placed in this slot. Used to
   * order slots heaviest-first so the search picks high-impact branches
   * before trivial ones. */
  weight: number
}

export function gatherSlotSpecs(input: MultiVariantInput): SlotSpec[] {
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
      // Canonical drain (baseDrainForMod) so a riven — whose baseDrain is
      // already its max-rank value — isn't double-counted by adding rank again.
      // abs keeps this a magnitude for the heaviest-slot ordering below.
      const drain = Math.abs(baseDrainForMod(mod.mod, mod.rank))
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

export function applyCandidate(
  formaPolarities: Partial<Record<SlotId, Polarity>>,
  id: SlotId,
  cand: SlotCandidate,
): void {
  if (cand === "__none__") delete formaPolarities[id]
  else formaPolarities[id] = cand
}

// ─── Stage 2/3 candidates: per-kind polarity buckets ───────────────────────

export interface KindCandidates {
  aura: Polarity[]
  exilus: Polarity[]
  stance: Polarity[]
  normal: Polarity[]
}

export function gatherKindCandidates(
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

export interface FormaSlotChoice {
  id: SlotId
  polarity: Polarity
}

// Exported for unit testing: the locked-stance guard below changes the
// candidate list, not the planner's final output (calculateCapacity ignores
// `formaPolarities.stance` under `lockedStance`), so it can't be asserted
// through the public plan API — pin it directly.
export function listFormaCandidates(
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
  // A locked exalted stance sets `stanceInnate`, but its slot can't be
  // forma'd — `calculateCapacity` ignores `formaPolarities.stance` when
  // `lockedStance` is set — so a stance-forma candidate can never change
  // feasibility. Skip it: leaving it in only wastes search budget (and could
  // surface a non-applicable "forma the stance slot" / Omni step).
  if (
    !input.lockedStance &&
    (input.stanceInnate !== undefined || hasStanceSlotLike(input))
  ) {
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
