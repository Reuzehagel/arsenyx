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
  return modPolarity === slotPolarity ? "match" : "mismatch"
}

export function effectiveDrainForMod(
  mod: Mod,
  rank: number,
  slotPolarity: Polarity | undefined,
): number {
  // Riven `baseDrain` is the user-configured drain at max rank (what the
  // game displays). Regular mods add 1 drain per rank on top of `baseDrain`.
  const base = isRivenMod(mod) ? mod.baseDrain : mod.baseDrain + rank
  if (!slotPolarity || slotPolarity === "universal") return base
  if (slotPolarity === "any") {
    return mod.polarity === "umbra" ? base : Math.ceil(base / 2)
  }
  if (mod.polarity === slotPolarity) return Math.ceil(base / 2)
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
  if (mod.polarity === slotPolarity) return base * 2
  return Math.round(base * 0.75)
}

export interface CapacityInput {
  placed: Partial<Record<SlotId, PlacedMod>>
  formaPolarities: Partial<Record<SlotId, Polarity>>
  auraInnates: (Polarity | undefined)[]
  normalInnates: (Polarity | undefined)[]
  hasReactor: boolean
  maxLevelCap?: number
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
    normalInnates,
    hasReactor,
    maxLevelCap,
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
      effectivePolarity(undefined, formaPolarities.exilus),
    )
  }
  for (let i = 0; i < normalInnates.length; i++) {
    const id = `normal-${i}` as SlotId
    const p = placed[id]
    if (!p) continue
    used += effectiveDrainForMod(
      p.mod,
      p.rank,
      effectivePolarity(normalInnates[i], formaPolarities[id]),
    )
  }

  return { used, max: base + auraBonus, base, auraBonus }
}

export interface FormaCountInput {
  auraInnates: (Polarity | undefined)[]
  exilusInnate?: Polarity
  normalInnates: (Polarity | undefined)[]
  formaPolarities: Partial<Record<SlotId, Polarity>>
}

export function calculateFormaCount(input: FormaCountInput): number {
  const { auraInnates, exilusInnate, normalInnates, formaPolarities } = input
  let total = 0

  for (let i = 0; i < auraInnates.length; i++) {
    total += singleSlotForma(
      auraInnates[i],
      formaPolarities[`aura-${i}` as SlotId],
    )
  }
  total += singleSlotForma(exilusInnate, formaPolarities.exilus)

  const normalSlots: NormalSlotEntry[] = normalInnates.map((innate, i) => ({
    innate,
    forma: formaPolarities[`normal-${i}` as SlotId],
  }))
  total += groupForma(normalSlots)

  return total
}
