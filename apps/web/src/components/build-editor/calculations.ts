import { isRivenMod } from "@arsenyx/shared/warframe/rivens"
import type { Mod, Polarity } from "@arsenyx/shared/warframe/types"

import type { PlacedMod, SlotId } from "./use-build-slots"

/**
 * Endo cost per rank, per the Warframe wiki's Fusion Costs table:
 *   `endo = 10 × rarityNumber × (2^rank - 1)`
 *
 * Rarity groupings (all share the same endo scale):
 *   - Common (1): just Common
 *   - Uncommon (2): Uncommon, Peculiar
 *   - Rare (3): Rare, Riven, Amalgam, Galvanized
 *   - Legendary (4): Legendary, Archon, Umbra, Primed (excluding Primed Chamber)
 *
 * Umbra and Primed mods are regular Legendary-rarity entries; no separate
 * curve. Antique Mods use a different formula (not modeled here).
 */
const ENDO_BASE_BY_RARITY: Record<Mod["rarity"], number> = {
  Common: 10,
  Uncommon: 20,
  Rare: 30,
  Legendary: 40,
  Peculiar: 20,
  Riven: 30,
  Amalgam: 30,
  Galvanized: 30,
}

export function calculateModEndoCost(placed: PlacedMod): number {
  const base = ENDO_BASE_BY_RARITY[placed.mod.rarity] ?? 20
  return base * (2 ** placed.rank - 1)
}

export function calculateTotalEndoCost(
  placed: Partial<Record<SlotId, PlacedMod>>,
): number {
  let total = 0
  for (const p of Object.values(placed)) {
    if (p) total += calculateModEndoCost(p)
  }
  return total
}

/** Resolve a slot's effective polarity: forma overrides innate; "universal" explicitly clears. */
export function effectivePolarity(
  innate: Polarity | undefined,
  forma: Polarity | undefined,
): Polarity | undefined {
  if (forma !== undefined) return forma === "universal" ? undefined : forma
  return innate
}

function singleSlotForma(
  innate: Polarity | undefined,
  forma: Polarity | undefined,
): number {
  return innate !== effectivePolarity(innate, forma) ? 1 : 0
}

interface NormalSlotEntry {
  innate: Polarity | undefined
  forma: Polarity | undefined
}

function groupForma(slots: NormalSlotEntry[]): number {
  const innateCounts: Partial<Record<Polarity, number>> = {}
  const effectiveCounts: Partial<Record<Polarity, number>> = {}

  for (const { innate, forma } of slots) {
    const eff = effectivePolarity(innate, forma)
    if (innate) innateCounts[innate] = (innateCounts[innate] ?? 0) + 1
    if (eff) effectiveCounts[eff] = (effectiveCounts[eff] ?? 0) + 1
  }

  const all = new Set<Polarity>([
    ...(Object.keys(innateCounts) as Polarity[]),
    ...(Object.keys(effectiveCounts) as Polarity[]),
  ])

  let additions = 0
  let removals = 0
  for (const p of all) {
    const a = innateCounts[p] ?? 0
    const b = effectiveCounts[p] ?? 0
    if (b > a) additions += b - a
    else if (a > b) removals += a - b
  }
  return Math.max(additions, removals)
}

export type MatchState = "match" | "mismatch" | "neutral"

/** Polarity-match state between a mod and a slot's effective polarity. */
export function getMatchState(
  modPolarity: Polarity,
  slotPolarity: Polarity | undefined,
): MatchState {
  if (!slotPolarity || slotPolarity === "universal") return "neutral"
  if (slotPolarity === "any") {
    return modPolarity === "umbra" ? "neutral" : "match"
  }
  // An "any" (Universal) polarity mod fits every polarized slot, so it always
  // earns the matching bonus — mirror of the "any"-polarity slot case above.
  if (modPolarity === "any") return "match"
  return modPolarity === slotPolarity ? "match" : "mismatch"
}

/**
 * Drain a mod contributes before any slot-polarity adjustment. Riven
 * `baseDrain` is the user-configured drain at max rank (what the game
 * displays); regular mods add 1 drain per rank on top of `baseDrain`.
 */
export function baseDrainForMod(mod: Mod, rank: number): number {
  return isRivenMod(mod) ? mod.baseDrain : mod.baseDrain + rank
}

export function effectiveDrainForMod(
  mod: Mod,
  rank: number,
  slotPolarity: Polarity | undefined,
): number {
  const base = baseDrainForMod(mod, rank)
  if (!slotPolarity || slotPolarity === "universal") return base
  if (slotPolarity === "any") {
    return mod.polarity === "umbra" ? base : Math.ceil(base / 2)
  }
  // "any"-polarity mods match every polarized slot (see getMatchState).
  if (mod.polarity === "any" || mod.polarity === slotPolarity) {
    return Math.ceil(base / 2)
  }
  return Math.round(base * 1.25)
}

export function auraBonusForMod(
  mod: Mod,
  rank: number,
  slotPolarity: Polarity | undefined,
): number {
  const base = Math.abs(mod.baseDrain) + rank
  if (!slotPolarity || slotPolarity === "universal") return base
  if (slotPolarity === "any") {
    return mod.polarity === "umbra" ? base : base * 2
  }
  // "any"-polarity mods match every polarized slot (see getMatchState).
  if (mod.polarity === "any" || mod.polarity === slotPolarity) return base * 2
  return Math.round(base * 0.75)
}

export interface CapacityInput {
  placed: Partial<Record<SlotId, PlacedMod>>
  formaPolarities: Partial<Record<SlotId, Polarity>>
  auraInnates: (Polarity | undefined)[]
  exilusInnate?: Polarity
  stanceInnate?: Polarity
  normalInnates: (Polarity | undefined)[]
  hasReactor: boolean
  maxLevelCap?: number
  /** Permanently installed exalted stance (Serene Storm, Primal Fury, …).
   * When set, its capacity bonus is added as if it were the stance slot's
   * mod — these locked stances live outside `placed`, so this is how their
   * +10 reaches the total. Takes precedence over `placed.stance`. */
  lockedStance?: PlacedMod
  /** Per-normal-slot flag: when set and the entry for slot `i` is false,
   * that slot's drain is excluded from `used`. Used by the Plexus, whose
   * Battle and Tactical mods don't consume the Integrated capacity pool.
   * Length must equal `normalInnates.length`; defaults to all-true. */
  normalSlotConsumesDrain?: boolean[]
}

export interface CapacityResult {
  used: number
  max: number
  base: number
  auraBonus: number
}

export function calculateCapacity(input: CapacityInput): CapacityResult {
  const {
    placed,
    formaPolarities,
    auraInnates,
    exilusInnate,
    stanceInnate,
    normalInnates,
    hasReactor,
    maxLevelCap,
    lockedStance,
    normalSlotConsumesDrain,
  } = input

  const level = maxLevelCap ?? 30
  const base = hasReactor ? level * 2 : level

  let auraBonus = 0
  for (let i = 0; i < auraInnates.length; i++) {
    const id = `aura-${i}` as SlotId
    const auraPlaced = placed[id]
    if (!auraPlaced) continue
    auraBonus += auraBonusForMod(
      auraPlaced.mod,
      auraPlaced.rank,
      effectivePolarity(auraInnates[i], formaPolarities[id]),
    )
  }

  let used = 0
  const exilus = placed.exilus
  if (exilus) {
    used += effectiveDrainForMod(
      exilus.mod,
      exilus.rank,
      effectivePolarity(exilusInnate, formaPolarities.exilus),
    )
  }
  // Stances act like auras: their drain is negative, surfaced as a capacity
  // bonus rather than a cost. At max rank: +5 with no/universal polarity,
  // +10 on matching polarity, +4 on mismatch — same scaling as aura mods.
  // A locked exalted stance lives outside `placed`, so prefer it when present
  // (those weapons never have a user-placed stance — the picker hides them).
  // Its slot can't be forma'd in-game, so ignore any stray `formaPolarities.stance`
  // (e.g. from a crafted share URL) and score against the innate polarity — its
  // own polarity always matches, so the bonus is a guaranteed +10.
  let stanceBonus = 0
  const stance = lockedStance ?? placed.stance
  if (stance) {
    const stancePolarity = lockedStance
      ? stanceInnate
      : effectivePolarity(stanceInnate, formaPolarities.stance)
    stanceBonus = auraBonusForMod(stance.mod, stance.rank, stancePolarity)
  }
  for (let i = 0; i < normalInnates.length; i++) {
    const id = `normal-${i}` as SlotId
    const p = placed[id]
    if (!p) continue
    if (normalSlotConsumesDrain && normalSlotConsumesDrain[i] === false) {
      continue
    }
    used += effectiveDrainForMod(
      p.mod,
      p.rank,
      effectivePolarity(normalInnates[i], formaPolarities[id]),
    )
  }

  return {
    used,
    max: base + auraBonus + stanceBonus,
    base,
    auraBonus,
  }
}

export interface FormaCountInput {
  auraInnates: (Polarity | undefined)[]
  exilusInnate?: Polarity
  stanceInnate?: Polarity
  normalInnates: (Polarity | undefined)[]
  formaPolarities: Partial<Record<SlotId, Polarity>>
}

export function calculateFormaCount(input: FormaCountInput): number {
  const {
    auraInnates,
    exilusInnate,
    stanceInnate,
    normalInnates,
    formaPolarities,
  } = input

  // Forma dedups WITHIN a slot type, never across types: an innate polarity
  // only offsets a mod of its own slot type. A frame's innate Aura polarity
  // can't make a normal-slot mod cheaper because a normal mod can't sit in the
  // Aura slot — so a forma'd aura must not cancel a same-polarity normal forma.
  // Normal slots are interchangeable, so they share one dedup pool; Aura (its
  // own pool, for 2-aura frames like Jade), Exilus, and Stance are scored
  // separately. This matches Overframe's forma count.
  const normalPool: NormalSlotEntry[] = normalInnates.map((innate, i) => ({
    innate,
    forma: formaPolarities[`normal-${i}` as SlotId],
  }))
  const auraPool: NormalSlotEntry[] = auraInnates.map((innate, i) => ({
    innate,
    forma: formaPolarities[`aura-${i}` as SlotId],
  }))

  return (
    groupForma(normalPool) +
    groupForma(auraPool) +
    singleSlotForma(exilusInnate, formaPolarities.exilus) +
    singleSlotForma(stanceInnate, formaPolarities.stance)
  )
}
