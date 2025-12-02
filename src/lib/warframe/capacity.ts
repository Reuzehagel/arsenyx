// Mod capacity calculation utilities
// Handles polarity matching, aura bonuses, and total capacity

import type { BuildState, ModSlot, PlacedMod, Polarity } from "./types";

// =============================================================================
// DRAIN CALCULATION
// =============================================================================

/**
 * Calculate the actual drain of a mod in a slot
 * - Matching polarity: floor(drain / 2)
 * - Mismatched polarity: ceil(drain * 1.25)
 * - No polarity (neutral): base drain
 */
export function calculateModDrain(
  mod: PlacedMod,
  slotPolarity?: Polarity
): number {
  // Base drain is baseDrain + rank (mods gain 1 drain per rank)
  const baseDrain = mod.baseDrain + mod.rank;

  if (!slotPolarity || slotPolarity === "universal") {
    // No slot polarity - use base drain
    return baseDrain;
  }

  if (mod.polarity === slotPolarity) {
    // Matching polarity - halved, rounded down
    return Math.floor(baseDrain / 2);
  }

  // Mismatched polarity - 25% penalty, rounded up
  return Math.ceil(baseDrain * 1.25);
}

/**
 * Get the effective polarity of a slot (forma'd or innate)
 */
export function getSlotPolarity(slot: ModSlot): Polarity | undefined {
  return slot.formaPolarity ?? slot.innatePolarity;
}

/**
 * Calculate drain for a mod in a specific slot
 */
export function calculateSlotDrain(slot: ModSlot): number {
  if (!slot.mod) return 0;

  const slotPolarity = getSlotPolarity(slot);
  return calculateModDrain(slot.mod, slotPolarity);
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
  auraSlotPolarity?: Polarity
): number {
  // Aura drain at current rank
  const modDrain = auraMod.baseDrain + auraMod.rank;

  if (!auraSlotPolarity || auraSlotPolarity === "universal") {
    // No slot polarity - base bonus
    return modDrain;
  }

  if (auraMod.polarity === auraSlotPolarity) {
    // Matching polarity - doubled bonus
    return modDrain * 2;
  }

  // Mismatched polarity - halved bonus
  return Math.floor(modDrain / 2);
}

// =============================================================================
// TOTAL CAPACITY CALCULATION
// =============================================================================

/**
 * Calculate total mod drain for a build (excluding aura)
 */
export function calculateTotalDrain(build: BuildState): number {
  let totalDrain = 0;

  // Exilus slot
  if (build.exilusSlot?.mod) {
    totalDrain += calculateSlotDrain(build.exilusSlot);
  }

  // Normal slots
  for (const slot of build.normalSlots) {
    if (slot.mod) {
      totalDrain += calculateSlotDrain(slot);
    }
  }

  return totalDrain;
}

/**
 * Calculate the aura bonus for a warframe build
 */
export function calculateBuildAuraBonus(build: BuildState): number {
  if (!build.auraSlot?.mod) return 0;

  const auraPolarity = getSlotPolarity(build.auraSlot);
  return calculateAuraBonus(build.auraSlot.mod, auraPolarity);
}

/**
 * Calculate the total available capacity for a build
 */
export function calculateMaxCapacity(build: BuildState): number {
  // Base capacity: 30, or 60 with reactor/catalyst
  const baseCapacity = build.hasReactor ? 60 : 30;

  // Add aura bonus for warframes
  const auraBonus = calculateBuildAuraBonus(build);

  return baseCapacity + auraBonus;
}

/**
 * Calculate remaining capacity for a build
 */
export function calculateRemainingCapacity(build: BuildState): number {
  const maxCapacity = calculateMaxCapacity(build);
  const totalDrain = calculateTotalDrain(build);

  return maxCapacity - totalDrain;
}

/**
 * Get capacity status for display
 */
export interface CapacityStatus {
  max: number;
  used: number;
  remaining: number;
  auraBonus: number;
  isOverCapacity: boolean;
}

export function getCapacityStatus(build: BuildState): CapacityStatus {
  const max = calculateMaxCapacity(build);
  const used = calculateTotalDrain(build);
  const remaining = max - used;
  const auraBonus = calculateBuildAuraBonus(build);

  return {
    max,
    used,
    remaining,
    auraBonus,
    isOverCapacity: remaining < 0,
  };
}

// =============================================================================
// POLARITY MATCHING HELPERS
// =============================================================================

/**
 * Check if a mod would benefit from a slot's polarity
 */
export function wouldMatchPolarity(
  mod: PlacedMod,
  slotPolarity?: Polarity
): boolean {
  if (!slotPolarity || slotPolarity === "universal") return false;
  return mod.polarity === slotPolarity;
}

/**
 * Check if a mod would be penalized by a slot's polarity
 */
export function wouldMismatchPolarity(
  mod: PlacedMod,
  slotPolarity?: Polarity
): boolean {
  if (!slotPolarity || slotPolarity === "universal") return false;
  return mod.polarity !== slotPolarity;
}

/**
 * Calculate drain difference if polarity were changed
 */
export function calculatePolarityBenefit(
  mod: PlacedMod,
  currentPolarity?: Polarity,
  newPolarity?: Polarity
): number {
  const currentDrain = calculateModDrain(mod, currentPolarity);
  const newDrain = calculateModDrain(mod, newPolarity);

  return currentDrain - newDrain; // Positive = saves capacity
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
};

/**
 * Calculate endo cost for a single mod at a given rank
 */
export function calculateModEndoCost(mod: PlacedMod): number {
  const baseEndo = ENDO_PER_RANK[mod.rarity] ?? 15;
  // Endo cost scales roughly exponentially with rank
  // This is a simplified approximation
  let totalEndo = 0;
  for (let i = 0; i < mod.rank; i++) {
    totalEndo += baseEndo * Math.pow(2, i);
  }
  return totalEndo;
}

/**
 * Calculate total endo cost for all mods in a build
 */
export function calculateTotalEndoCost(build: BuildState): number {
  let totalEndo = 0;

  // Aura slot
  if (build.auraSlot?.mod) {
    totalEndo += calculateModEndoCost(build.auraSlot.mod);
  }

  // Exilus slot
  if (build.exilusSlot?.mod) {
    totalEndo += calculateModEndoCost(build.exilusSlot.mod);
  }

  // Normal slots
  for (const slot of build.normalSlots) {
    if (slot.mod) {
      totalEndo += calculateModEndoCost(slot.mod);
    }
  }

  return totalEndo;
}
