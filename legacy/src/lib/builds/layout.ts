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
  auraSlotCount: number
  hasExilusSlot: boolean
  normalSlotCount: number
  arcaneSlotCount: number
  shardSlotCount: number
  helminthAllowed: boolean
  archgunDualArcaneMode: boolean
}

function getAuraSlotCount(item: BrowseableItem): number {
  const rawAura = (item as { aura?: string | string[] }).aura
  if (Array.isArray(rawAura)) return rawAura.length
  return 1 // Warframes always have at least 1 aura slot
}

export function getBuildLayout(
  item: BrowseableItem,
  category: BrowseCategory,
): BuildLayout {
  switch (category) {
    case "warframes":
      return {
        auraSlotCount: getAuraSlotCount(item),
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
        auraSlotCount: 0,
        hasExilusSlot: true,
        normalSlotCount: 8,
        arcaneSlotCount: 1,
        shardSlotCount: 0,
        helminthAllowed: false,
        archgunDualArcaneMode: false,
      }
    case "necramechs":
      return {
        auraSlotCount: 0,
        hasExilusSlot: false,
        normalSlotCount: 12,
        arcaneSlotCount: 2,
        shardSlotCount: 0,
        helminthAllowed: false,
        archgunDualArcaneMode: false,
      }
    case "companions":
      return {
        auraSlotCount: 0,
        hasExilusSlot: false,
        normalSlotCount: 10,
        arcaneSlotCount: 0,
        shardSlotCount: 0,
        helminthAllowed: false,
        archgunDualArcaneMode: false,
      }
    case "archwing": {
      const itemType = (item as { type?: string }).type
      const isArchGun = itemType === "Arch-Gun"
      const isArchMelee = itemType === "Arch-Melee"
      const isWeapon = isArchGun || isArchMelee
      return {
        auraSlotCount: 0,
        hasExilusSlot: !isWeapon,
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
        auraSlotCount: 0,
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

function getAuraPolarities(item: BrowseableItem): (string | undefined)[] {
  const rawAura = (item as { aura?: string | string[] }).aura
  if (!rawAura) return [undefined]
  if (Array.isArray(rawAura)) {
    // WFCD format: array of polarity strings per aura slot
    // e.g. Jade: ["aura", "vazarin"] — "aura" is not a real polarity
    return rawAura.map((p) => {
      const normalized = normalizePolarity(p)
      return normalized === "universal" && p !== "universal" ? undefined : normalized
    })
  }
  return [rawAura]
}

export function createBaseBuildState(
  item: BrowseableItem,
  category: BrowseCategory,
): BuildState {
  const layout = getBuildLayout(item, category)
  const itemPolarities = (item as { polarities?: string[] }).polarities
  const auraPolarities = getAuraPolarities(item)

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
    auraSlots: Array.from({ length: layout.auraSlotCount }, (_, i) => ({
      id: `aura-${i}`,
      type: "aura" as const,
      innatePolarity: auraPolarities[i]
        ? normalizePolarity(auraPolarities[i])
        : undefined,
    })),
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
  if (slotId.startsWith("aura-")) {
    const idx = Number(slotId.slice("aura-".length))
    return buildState.auraSlots[idx]
  }
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
  if (slotId.startsWith("aura-")) {
    const idx = Number(slotId.slice("aura-".length))
    if (idx >= 0 && idx < buildState.auraSlots.length) {
      buildState.auraSlots[idx] = slot
    }
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
