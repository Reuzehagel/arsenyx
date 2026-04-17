// Test fixtures for build states
import type { BuildState, ModSlot, Polarity } from "@/lib/warframe/types"

/**
 * Create an empty mod slot
 */
export function createModSlot(
  id: string,
  type: "aura" | "exilus" | "normal",
  innatePolarity?: Polarity,
): ModSlot {
  return {
    id,
    type,
    innatePolarity,
  }
}

/**
 * Create a minimal empty build state for testing
 */
export function createEmptyBuildState(
  overrides: Partial<BuildState> = {},
): BuildState {
  return {
    itemUniqueName: "/Lotus/Powersuits/Excalibur/Excalibur",
    itemName: "Excalibur",
    itemCategory: "warframes",
    hasReactor: false,
    auraSlots: [createModSlot("aura-0", "aura", "madurai")],
    exilusSlot: createModSlot("exilus-0", "exilus"),
    normalSlots: Array.from({ length: 8 }, (_, i) =>
      createModSlot(`normal-${i}`, "normal"),
    ),
    arcaneSlots: [],
    shardSlots: [null, null, null, null, null],
    baseCapacity: 30,
    currentCapacity: 30,
    formaCount: 0,
    ...overrides,
  }
}

/**
 * Create a warframe build state with specific polarities
 */
export function createWarframeBuildWithPolarities(
  normalPolarities: (Polarity | undefined)[],
): BuildState {
  return {
    itemUniqueName: "/Lotus/Powersuits/Excalibur/Excalibur",
    itemName: "Excalibur",
    itemCategory: "warframes",
    hasReactor: true,
    auraSlots: [createModSlot("aura-0", "aura", "madurai")],
    exilusSlot: createModSlot("exilus-0", "exilus"),
    normalSlots: normalPolarities.map((polarity, i) =>
      createModSlot(`normal-${i}`, "normal", polarity),
    ),
    arcaneSlots: [],
    shardSlots: [null, null, null, null, null],
    baseCapacity: 60,
    currentCapacity: 60,
    formaCount: 0,
  }
}

/**
 * Create a weapon build state
 */
export function createWeaponBuildState(
  category: "primary" | "secondary" | "melee",
  overrides: Partial<BuildState> = {},
): BuildState {
  return {
    itemUniqueName: "/Lotus/Weapons/Tenno/LongGuns/Braton/Braton",
    itemName: "Braton",
    itemCategory: category,
    hasReactor: false,
    auraSlots: [],
    exilusSlot: createModSlot("exilus-0", "exilus"),
    normalSlots: Array.from({ length: 8 }, (_, i) =>
      createModSlot(`normal-${i}`, "normal"),
    ),
    arcaneSlots: [],
    shardSlots: [],
    baseCapacity: 30,
    currentCapacity: 30,
    formaCount: 0,
    ...overrides,
  }
}
