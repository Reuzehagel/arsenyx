import { getArcanesForSlot } from "@/lib/warframe/mods"
import { normalizePolarity } from "@/lib/warframe/mods"
import type {
  Arcane,
  BrowseCategory,
  BrowseableItem,
  BuildState,
  ModSlot,
} from "@/lib/warframe/types"

export interface BuildLayout {
  hasAuraSlot: boolean
  hasExilusSlot: boolean
  normalSlotCount: number
  arcaneSlotCount: number
  shardSlotCount: number
  helminthAllowed: boolean
  archgunDualArcaneMode: boolean
}

export function getBuildLayout(
  item: BrowseableItem,
  category: BrowseCategory,
): BuildLayout {
  switch (category) {
    case "warframes":
      return {
        hasAuraSlot: true,
        hasExilusSlot: true,
        normalSlotCount: 8,
        arcaneSlotCount: 2,
        shardSlotCount: 5,
        helminthAllowed: true,
        archgunDualArcaneMode: false,
      }
    case "primary":
    case "secondary":
    case "melee":
      return {
        hasAuraSlot: false,
        hasExilusSlot: true,
        normalSlotCount: 8,
        arcaneSlotCount: 1,
        shardSlotCount: 0,
        helminthAllowed: false,
        archgunDualArcaneMode: false,
      }
    case "necramechs":
      return {
        hasAuraSlot: false,
        hasExilusSlot: false,
        normalSlotCount: 12,
        arcaneSlotCount: 2,
        shardSlotCount: 0,
        helminthAllowed: false,
        archgunDualArcaneMode: false,
      }
    case "companions":
      return {
        hasAuraSlot: false,
        hasExilusSlot: false,
        normalSlotCount: 10,
        arcaneSlotCount: 0,
        shardSlotCount: 0,
        helminthAllowed: false,
        archgunDualArcaneMode: false,
      }
    case "archwing": {
      const isArchGun = (item as { type?: string }).type === "Arch-Gun"
      return {
        hasAuraSlot: false,
        hasExilusSlot: true,
        normalSlotCount: 8,
        arcaneSlotCount: isArchGun ? 2 : 0,
        shardSlotCount: 0,
        helminthAllowed: false,
        archgunDualArcaneMode: isArchGun,
      }
    }
    case "companion-weapons":
    case "exalted-weapons":
      return {
        hasAuraSlot: false,
        hasExilusSlot: true,
        normalSlotCount: 8,
        arcaneSlotCount: 0,
        shardSlotCount: 0,
        helminthAllowed: false,
        archgunDualArcaneMode: false,
      }
  }
}

export function createInitialModSlots(
  count: number,
  polarities?: string[],
): ModSlot[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `normal-${index}`,
    type: "normal",
    innatePolarity: polarities?.[index]
      ? normalizePolarity(polarities[index])
      : undefined,
  }))
}

export function createBaseBuildState(
  item: BrowseableItem,
  category: BrowseCategory,
): BuildState {
  const layout = getBuildLayout(item, category)
  const itemPolarities = (item as { polarities?: string[] }).polarities
  const auraPolarity = (item as { aura?: string }).aura

  // Kuva/Tenet/Coda weapons have maxLevelCap: 40 → capacity 80 with catalyst
  const maxLevelCap =
    (item as { maxLevelCap?: number }).maxLevelCap ?? 30
  const baseCapacity = maxLevelCap * 2 // doubled by reactor/catalyst (always assumed on)

  const buildState: BuildState = {
    itemUniqueName: item.uniqueName,
    itemName: item.name,
    itemCategory: category,
    itemImageName: item.imageName,
    hasReactor: true,
    maxLevelCap,
    auraSlot: layout.hasAuraSlot
      ? {
          id: "aura-0",
          type: "aura",
          innatePolarity: auraPolarity
            ? normalizePolarity(auraPolarity)
            : undefined,
        }
      : undefined,
    exilusSlot: layout.hasExilusSlot
      ? {
          id: "exilus-0",
          type: "exilus",
        }
      : undefined,
    normalSlots: createInitialModSlots(layout.normalSlotCount, itemPolarities),
    arcaneSlots: Array.from({ length: layout.arcaneSlotCount }, () => null),
    shardSlots: Array.from({ length: layout.shardSlotCount }, () => null),
    baseCapacity,
    currentCapacity: baseCapacity,
    formaCount: 0,
  }

  return buildState
}

export function getBuildSlot(
  buildState: BuildState,
  slotId: string,
): ModSlot | undefined {
  if (slotId === "aura-0") return buildState.auraSlot
  if (slotId === "exilus-0") return buildState.exilusSlot

  if (slotId.startsWith("normal-")) {
    const slotIndex = Number(slotId.slice("normal-".length))
    if (
      Number.isInteger(slotIndex) &&
      slotIndex >= 0 &&
      slotIndex < buildState.normalSlots.length
    ) {
      return buildState.normalSlots[slotIndex]
    }
  }

  return undefined
}

export function setBuildSlot(
  buildState: BuildState,
  slotId: string,
  slot: ModSlot,
): void {
  if (slotId === "aura-0") {
    buildState.auraSlot = slot
    return
  }

  if (slotId === "exilus-0") {
    buildState.exilusSlot = slot
    return
  }

  if (slotId.startsWith("normal-")) {
    const slotIndex = Number(slotId.slice("normal-".length))
    if (
      Number.isInteger(slotIndex) &&
      slotIndex >= 0 &&
      slotIndex < buildState.normalSlots.length
    ) {
      buildState.normalSlots[slotIndex] = slot
    }
  }
}

export function getCompatibleArcanesForItem(
  item: BrowseableItem,
  category: BrowseCategory,
): Arcane[] {
  const layout = getBuildLayout(item, category)

  if (layout.arcaneSlotCount === 0) {
    return []
  }

  switch (category) {
    case "warframes":
    case "necramechs":
      return getArcanesForSlot("warframe")
    case "primary":
      return getArcanesForSlot("primary")
    case "secondary":
      return getArcanesForSlot("secondary")
    case "melee":
      return getArcanesForSlot("melee")
    case "archwing":
      if (layout.archgunDualArcaneMode) {
        return [
          ...getArcanesForSlot("primary"),
          ...getArcanesForSlot("secondary"),
        ]
      }
      return []
    default:
      return []
  }
}

export function getCompatibleArcanesForSlotIndex(
  item: BrowseableItem,
  category: BrowseCategory,
  slotIndex: number,
): Arcane[] {
  const layout = getBuildLayout(item, category)

  if (slotIndex < 0 || slotIndex >= layout.arcaneSlotCount) {
    return []
  }

  if (category === "archwing" && layout.archgunDualArcaneMode) {
    return slotIndex === 0
      ? getArcanesForSlot("primary")
      : getArcanesForSlot("secondary")
  }

  return getCompatibleArcanesForItem(item, category)
}
