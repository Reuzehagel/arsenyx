// Mod capacity calculation utilities
// Handles polarity matching, aura bonuses, and total capacity

import type { BuildState, ModSlot, PlacedMod, Polarity } from "./types"

// =============================================================================
// DRAIN CALCULATION
// =============================================================================

/**
 * Calculate the actual drain of a mod in a slot
 * - Matching polarity: ceil(drain / 2)
 * - Mismatched polarity: ceil(drain * 1.25)
 * - No polarity (neutral): base drain
 */
export function calculateModDrain(
  mod: PlacedMod,
  slotPolarity?: Polarity,
): number {
  // Base drain is baseDrain + rank (mods gain 1 drain per rank)
  const baseDrain = mod.baseDrain + mod.rank

  if (!slotPolarity || slotPolarity === "universal") {
    // No slot polarity - use base drain
    return baseDrain
  }

  // Universal/Omni Forma: matches any polarity except Umbra.
  // Umbra mods in an "any" slot behave like neutral (no discount, no penalty).
  if (slotPolarity === "any") {
    return mod.polarity === "umbra" ? baseDrain : Math.ceil(baseDrain / 2)
  }

  if (mod.polarity === slotPolarity) {
    // Matching polarity - halved, rounded up
    return Math.ceil(baseDrain / 2)
  }

  // Mismatched polarity - 25% penalty, rounded up
  return Math.ceil(baseDrain * 1.25)
}

/**
 * Get the effective polarity of a slot (forma'd or innate)
 */
export function getSlotPolarity(slot: ModSlot): Polarity | undefined {
  // If formaPolarity is set:
  // - "universal" means explicitly cleared to no polarity
  // - Any other value means use that polarity
  // If formaPolarity is undefined, fall back to innatePolarity
  if (slot.formaPolarity !== undefined) {
    return slot.formaPolarity === "universal" ? undefined : slot.formaPolarity
  }
  return slot.innatePolarity
}

/**
 * Calculate drain for a mod in a specific slot
 */
export function calculateSlotDrain(slot: ModSlot): number {
  if (!slot.mod) return 0

  const slotPolarity = getSlotPolarity(slot)
  return calculateModDrain(slot.mod, slotPolarity)
}

// =============================================================================
// AURA BONUS CALCULATION
// =============================================================================

/**
 * Calculate the capacity bonus from an aura mod
 * - Matching polarity: mod drain * 2
 * - Mismatched polarity: floor(mod drain / 2)
 * - No polarity (neutral): mod drain
 */
export function calculateAuraBonus(
  auraMod: PlacedMod,
  auraSlotPolarity?: Polarity,
): number {
  // Aura drain at current rank
  // Note: aura mods have negative base drain in data, so we take abs
  const modDrain = Math.abs(auraMod.baseDrain) + auraMod.rank

  if (!auraSlotPolarity || auraSlotPolarity === "universal") {
    // No slot polarity - base bonus
    return modDrain
  }

  // Universal/Omni Forma: matches any polarity except Umbra.
  // Umbra aura in an "any" slot behaves like neutral.
  if (auraSlotPolarity === "any") {
    return auraMod.polarity === "umbra" ? modDrain : modDrain * 2
  }

  if (auraMod.polarity === auraSlotPolarity) {
    // Matching polarity - doubled bonus
    return modDrain * 2
  }

  // Mismatched polarity - halved bonus
  return Math.floor(modDrain / 2)
}

// =============================================================================
// TOTAL CAPACITY CALCULATION
// =============================================================================

/**
 * Calculate total mod drain for a build (excluding aura)
 */
export function calculateTotalDrain(build: BuildState): number {
  let totalDrain = 0

  // Exilus slot
  if (build.exilusSlot?.mod) {
    totalDrain += calculateSlotDrain(build.exilusSlot)
  }

  // Normal slots
  for (const slot of build.normalSlots) {
    if (slot.mod) {
      totalDrain += calculateSlotDrain(slot)
    }
  }

  return totalDrain
}

/**
 * Calculate the aura bonus for a warframe build
 */
export function calculateBuildAuraBonus(build: BuildState): number {
  let totalBonus = 0
  for (const slot of build.auraSlots) {
    if (slot.mod) {
      const auraPolarity = getSlotPolarity(slot)
      totalBonus += calculateAuraBonus(slot.mod, auraPolarity)
    }
  }
  return totalBonus
}

/**
 * Calculate the total available capacity for a build
 */
export function calculateMaxCapacity(build: BuildState): number {
  // Kuva/Tenet/Coda weapons have maxLevelCap 40 → base capacity 40/80
  const maxLevel = build.maxLevelCap ?? 30
  const baseCapacity = build.hasReactor ? maxLevel * 2 : maxLevel

  // Add aura bonus for warframes
  const auraBonus = calculateBuildAuraBonus(build)

  return baseCapacity + auraBonus
}

/**
 * Calculate remaining capacity for a build
 */
export function calculateRemainingCapacity(build: BuildState): number {
  const maxCapacity = calculateMaxCapacity(build)
  const totalDrain = calculateTotalDrain(build)

  return maxCapacity - totalDrain
}

/**
 * Get capacity status for display
 */
export interface CapacityStatus {
  max: number
  used: number
  remaining: number
  auraBonus: number
  isOverCapacity: boolean
}

export function getCapacityStatus(build: BuildState): CapacityStatus {
  const max = calculateMaxCapacity(build)
  const used = calculateTotalDrain(build)
  const remaining = max - used
  const auraBonus = calculateBuildAuraBonus(build)

  return {
    max,
    used,
    remaining,
    auraBonus,
    isOverCapacity: remaining < 0,
  }
}

// =============================================================================
// POLARITY MATCHING HELPERS
// =============================================================================

/**
 * Check if a mod would benefit from a slot's polarity
 */
export function wouldMatchPolarity(
  mod: PlacedMod,
  slotPolarity?: Polarity,
): boolean {
  if (!slotPolarity || slotPolarity === "universal") return false
  if (slotPolarity === "any") return mod.polarity !== "umbra"
  return mod.polarity === slotPolarity
}

/**
 * Check if a mod would be penalized by a slot's polarity
 */
export function wouldMismatchPolarity(
  mod: PlacedMod,
  slotPolarity?: Polarity,
): boolean {
  if (!slotPolarity || slotPolarity === "universal") return false
  if (slotPolarity === "any") return false
  return mod.polarity !== slotPolarity
}

/**
 * Calculate drain difference if polarity were changed
 */
export function calculatePolarityBenefit(
  mod: PlacedMod,
  currentPolarity?: Polarity,
  newPolarity?: Polarity,
): number {
  const currentDrain = calculateModDrain(mod, currentPolarity)
  const newDrain = calculateModDrain(mod, newPolarity)

  return currentDrain - newDrain // Positive = saves capacity
}

// =============================================================================
// POLARITY MATCH STATE (FOR UI COLORING)
// =============================================================================

export type MatchState = "match" | "mismatch" | "neutral"

/**
 * Get the match state between a mod and slot polarity for UI styling
 * - "match" = mod polarity matches slot polarity (green, reduced drain)
 * - "mismatch" = mod polarity differs from slot polarity (red, increased drain)
 * - "neutral" = slot has no polarity or universal (default color)
 */
export function getMatchState(
  modPolarity: Polarity,
  slotPolarity?: Polarity,
): MatchState {
  if (!slotPolarity || slotPolarity === "universal") {
    return "neutral"
  }

  if (slotPolarity === "any") {
    return modPolarity === "umbra" ? "neutral" : "match"
  }
  return modPolarity === slotPolarity ? "match" : "mismatch"
}

// =============================================================================
// FORMA COUNT CALCULATION
// =============================================================================

/**
 * Calculate forma needed for a group of slots using NET polarity comparison.
 *
 * In Warframe, you can swap polarity positions freely within the same slot type.
 * So we use a multiset comparison of REAL polarities (excluding "none"):
 * - Count how many of each real polarity type you need vs have innate
 * - Additions: polarities you need but don't have enough of
 * - Removals: polarities you have but don't need
 * - forma = max(additions, removals) because each forma both removes and adds
 *
 * @param slots - Array of slots to calculate forma for (should all be same type)
 * @returns Number of forma needed
 */
function calculateSlotGroupForma(slots: ModSlot[]): number {
  // Count innate and effective REAL polarities (excluding "none")
  const innateCounts: Record<string, number> = {}
  const effectiveCounts: Record<string, number> = {}

  for (const slot of slots) {
    const innate = slot.innatePolarity // undefined = no polarity
    const effective = getSlotPolarity(slot) // undefined = no polarity

    // Only count real polarities, skip "none"/undefined
    if (innate) {
      innateCounts[innate] = (innateCounts[innate] ?? 0) + 1
    }
    if (effective) {
      effectiveCounts[effective] = (effectiveCounts[effective] ?? 0) + 1
    }
  }

  // Get all real polarity types
  const allPolarities = new Set([
    ...Object.keys(innateCounts),
    ...Object.keys(effectiveCounts),
  ])

  let additions = 0
  let removals = 0

  for (const polarity of allPolarities) {
    const innateCount = innateCounts[polarity] ?? 0
    const effectiveCount = effectiveCounts[polarity] ?? 0

    if (effectiveCount > innateCount) {
      // Need to ADD this polarity (costs forma)
      additions += effectiveCount - innateCount
    } else if (innateCount > effectiveCount) {
      // Need to REMOVE this polarity (costs forma)
      removals += innateCount - effectiveCount
    }
  }

  // Each forma changes one slot's polarity, simultaneously removing the old
  // and adding the new. Paired changes (X→Y) satisfy one addition AND one
  // removal, so the total forma needed is whichever count is larger.
  return Math.max(additions, removals)
}

/**
 * Calculate forma for a single slot (simple: changed or not)
 */
function calculateSingleSlotForma(slot: ModSlot): number {
  const innate = slot.innatePolarity
  const effective = getSlotPolarity(slot)
  return innate !== effective ? 1 : 0
}

/**
 * Calculate the forma count for a build using NET polarity changes.
 *
 * IMPORTANT: Polarities can only be swapped within the same slot type!
 * - Aura slot polarities can't move to normal slots
 * - Exilus slot polarities can't move to normal slots
 * - Normal slot polarities can swap among themselves
 *
 * So we calculate forma separately for each slot type, then sum them.
 *
 * Examples:
 * - Normal [naramon, vazarin] -> [vazarin, naramon]: 0 forma (swapped)
 * - Normal [naramon, none] -> [none, naramon]: 0 forma (moved)
 * - Normal [none, none] -> [madurai, madurai]: 2 forma (added 2)
 * - Aura [madurai] -> [any]: 1 forma (changed type)
 */
export function calculateFormaCount(
  normalSlots: ModSlot[],
  auraSlots: ModSlot[],
  exilusSlot?: ModSlot,
): number {
  let total = 0

  // Aura slots
  for (const auraSlot of auraSlots) {
    total += calculateSingleSlotForma(auraSlot)
  }

  // Exilus slot (single slot - just check if changed)
  if (exilusSlot) {
    total += calculateSingleSlotForma(exilusSlot)
  }

  // Normal slots (multiple slots - use multiset formula for swapping)
  if (normalSlots.length > 0) {
    total += calculateSlotGroupForma(normalSlots)
  }

  return total
}

// =============================================================================
// ENDO COST CALCULATION
// =============================================================================

/**
 * Base endo costs per rank by rarity (approximate Warframe values)
 */
const ENDO_PER_RANK: Record<string, number> = {
  Common: 10,
  Uncommon: 15,
  Rare: 20,
  Legendary: 30,
  Peculiar: 15,
}

/**
 * Calculate endo cost for a single mod at a given rank
 */
export function calculateModEndoCost(mod: PlacedMod): number {
  const baseEndo = ENDO_PER_RANK[mod.rarity] ?? 15
  // Endo cost scales roughly exponentially with rank
  // This is a simplified approximation
  let totalEndo = 0
  for (let i = 0; i < mod.rank; i++) {
    totalEndo += baseEndo * Math.pow(2, i)
  }
  return totalEndo
}

/**
 * Calculate total endo cost for all mods in a build
 */
export function calculateTotalEndoCost(build: BuildState): number {
  let totalEndo = 0

  // Aura slots
  for (const slot of build.auraSlots) {
    if (slot.mod) {
      totalEndo += calculateModEndoCost(slot.mod)
    }
  }

  // Exilus slot
  if (build.exilusSlot?.mod) {
    totalEndo += calculateModEndoCost(build.exilusSlot.mod)
  }

  // Normal slots
  for (const slot of build.normalSlots) {
    if (slot.mod) {
      totalEndo += calculateModEndoCost(slot.mod)
    }
  }

  return totalEndo
}
