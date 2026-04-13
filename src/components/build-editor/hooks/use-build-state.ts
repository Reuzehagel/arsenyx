import { useReducer, useCallback, useMemo } from "react"

import { createBaseBuildState } from "@/lib/builds/layout"
import {
  getCapacityStatus,
  calculateTotalEndoCost,
  calculateFormaCount,
} from "@/lib/warframe/capacity"
import { toPlacedMod } from "@/lib/warframe/mod-utils"
import { getModBaseName } from "@/lib/warframe/mod-variants"
import type {
  BuildState,
  ModSlot,
  PlacedMod,
  PlacedArcane,
  PlacedShard,
  Polarity,
  BrowseCategory,
  BrowseableItem,
  Mod,
  Arcane,
  HelminthAbility,
  ItemStats,
} from "@/lib/warframe/types"

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export type DragItem =
  | { type: "search-mod"; mod: Mod; rank: number }
  | { type: "placed-mod"; mod: PlacedMod; slotId: string; rank?: number }
  | { type: "search-arcane"; arcane: Arcane; rank: number }
  | { type: "placed-arcane"; arcane: PlacedArcane; slotIndex: number }

export interface BuildContainerProps {
  item: BrowseableItem
  category: BrowseCategory
  categoryLabel: string
  compatibleMods: Mod[]
  helminthAugmentMods?: Record<string, Mod[]>
  compatibleArcanes?: Arcane[]
  importedBuild?: Partial<BuildState>
  savedBuildId?: string
  readOnly?: boolean
  isOwner?: boolean
  initialGuide?: {
    summary?: string | null
    description?: string | null
    updatedAt?: Date
  }
  initialPartnerBuilds?: {
    id: string
    slug: string
    name: string
    item: {
      name: string
      imageName: string | null
      browseCategory: string
    }
    buildData: { formaCount: number }
  }[]
  initialOrganizationSlug?: string | null
  initialVisibility?: "PUBLIC" | "UNLISTED" | "PRIVATE"
}

export function extractItemStats(item: BrowseableItem): ItemStats {
  const data = item as {
    health?: number
    shield?: number
    armor?: number
    power?: number
    sprintSpeed?: number
    abilities?: Array<{
      name: string
      imageName?: string
      description: string
    }>
    fireRate?: number
    criticalChance?: number
    criticalMultiplier?: number
    procChance?: number
    totalDamage?: number
    magazineSize?: number
    reloadTime?: number
    range?: number
    comboDuration?: number
  }
  return {
    health: data.health,
    shield: data.shield,
    armor: data.armor,
    energy: data.power,
    sprintSpeed: data.sprintSpeed,
    abilities: data.abilities,
    fireRate: data.fireRate,
    criticalChance: data.criticalChance,
    criticalMultiplier: data.criticalMultiplier,
    procChance: data.procChance,
    totalDamage: data.totalDamage,
    magazineSize: data.magazineSize,
    reloadTime: data.reloadTime,
    range: data.range,
    comboDuration: data.comboDuration,
  }
}

export function createInitialBuildState(
  item: BrowseableItem,
  category: BrowseCategory,
  compatibleMods: Mod[],
  importedBuild?: Partial<BuildState>,
  compatibleArcanes?: Arcane[],
  helminthAugmentMods?: Record<string, Mod[]>,
): BuildState {
  const baseState = createBaseBuildState(item, category)

  if (importedBuild) {
    const mergeSlot = (baseSlot: ModSlot, importedSlot?: ModSlot): ModSlot => {
      if (!importedSlot) return baseSlot
      return {
        ...baseSlot,
        formaPolarity: importedSlot.formaPolarity,
        mod: importedSlot.mod,
      }
    }

    const mergedNormalSlots = baseState.normalSlots.map(
      (baseSlot: ModSlot, i: number) =>
        mergeSlot(baseSlot, importedBuild.normalSlots?.[i]),
    )

    const mergedAuraSlots = baseState.auraSlots.map(
      (baseSlot: ModSlot, i: number) =>
        mergeSlot(baseSlot, importedBuild.auraSlots?.[i]),
    )

    const mergedExilusSlot = baseState.exilusSlot
      ? mergeSlot(baseState.exilusSlot, importedBuild.exilusSlot)
      : undefined

    const hydratedState: BuildState = {
      ...baseState,
      ...importedBuild,
      itemUniqueName: item.uniqueName,
      itemName: item.name,
      itemCategory: category,
      itemImageName: item.imageName,
      normalSlots: mergedNormalSlots,
      auraSlots: mergedAuraSlots,
      exilusSlot: mergedExilusSlot,
    }

    const modMap = new Map(compatibleMods.map((m) => [m.uniqueName, m]))

    // Add all helminth augments so they hydrate even without helminthAbility data
    if (helminthAugmentMods) {
      for (const augments of Object.values(helminthAugmentMods)) {
        for (const mod of augments) {
          modMap.set(mod.uniqueName, mod)
        }
      }
    }

    const hydrateSlot = (slot: ModSlot) => {
      if (slot.mod) {
        const fullMod = modMap.get(slot.mod.uniqueName)
        if (fullMod) {
          slot.mod = {
            ...slot.mod,
            name: fullMod.name,
            imageName: fullMod.imageName,
            polarity: fullMod.polarity,
            baseDrain: fullMod.baseDrain,
            fusionLimit: fullMod.fusionLimit,
            rarity: fullMod.rarity,
            compatName: fullMod.compatName,
            type: fullMod.type,
            levelStats: fullMod.levelStats,
            modSet: fullMod.modSet,
            modSetStats: fullMod.modSetStats,
            isExilus: fullMod.isExilus,
            isUtility: fullMod.isUtility,
          }
        }
      }
      return slot
    }

    hydratedState.auraSlots = hydratedState.auraSlots.map(hydrateSlot)
    if (hydratedState.exilusSlot) {
      hydratedState.exilusSlot = hydrateSlot(hydratedState.exilusSlot)
    }
    hydratedState.normalSlots = hydratedState.normalSlots.map(hydrateSlot)

    // Hydrate arcane slots — the build codec only stores uniqueName + rank,
    // so we need to fill in name, imageName, rarity from the arcane list.
    if (compatibleArcanes && hydratedState.arcaneSlots) {
      const arcaneMap = new Map(compatibleArcanes.map((a) => [a.uniqueName, a]))
      hydratedState.arcaneSlots = hydratedState.arcaneSlots.map((arcane) => {
        if (!arcane) return null
        if (arcane.name && arcane.imageName) return arcane // Already hydrated
        const fullArcane = arcaneMap.get(arcane.uniqueName)
        if (fullArcane) {
          return {
            ...arcane,
            name: fullArcane.name,
            imageName: fullArcane.imageName,
            rarity: fullArcane.rarity,
          }
        }
        return arcane
      })
    }

    return hydratedState
  }

  return baseState
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export type BuildAction =
  | { type: "PLACE_MOD"; mod: Mod; rank: number; slotId: string }
  | { type: "MOVE_MOD"; sourceSlotId: string; targetSlotId: string }
  | { type: "REMOVE_MOD"; slotId: string }
  | { type: "CHANGE_RANK"; slotId: string; newRank: number }
  | { type: "APPLY_FORMA"; slotId: string; polarity: Polarity }
  | { type: "TOGGLE_REACTOR" }
  | {
      type: "CLEAR_BUILD"
      item: BrowseableItem
      category: BrowseCategory
      compatibleMods: Mod[]
    }
  | {
      type: "SET_HELMINTH"
      slotIndex: number
      ability: HelminthAbility | null
    }
  | { type: "PLACE_ARCANE"; arcane: Arcane; rank: number; slotIndex: number }
  | { type: "MOVE_ARCANE"; sourceIndex: number; targetIndex: number }
  | { type: "REMOVE_ARCANE"; slotIndex: number }
  | { type: "CHANGE_ARCANE_RANK"; slotIndex: number; newRank: number }
  | { type: "PLACE_SHARD"; slotIndex: number; shard: PlacedShard }
  | { type: "REMOVE_SHARD"; slotIndex: number }
  | {
      type: "HYDRATE"
      state: Partial<BuildState>
      item: BrowseableItem
      category: BrowseCategory
    }

// Slot-level helpers used by multiple actions
function getModFromSlot(id: string, state: BuildState): PlacedMod | undefined {
  if (id.startsWith("aura-")) {
    const idx = parseInt(id.slice("aura-".length))
    return state.auraSlots[idx]?.mod
  }
  if (id.startsWith("exilus")) return state.exilusSlot?.mod
  const idx = parseInt(id.replace("normal-", ""))
  return state.normalSlots[idx]?.mod
}

function setModInSlot(
  id: string,
  mod: PlacedMod | undefined,
  state: BuildState,
) {
  if (id.startsWith("aura-")) {
    const idx = parseInt(id.slice("aura-".length))
    if (idx >= 0 && idx < state.auraSlots.length) {
      state.auraSlots = [...state.auraSlots]
      state.auraSlots[idx] = { ...state.auraSlots[idx], mod }
    }
  } else if (id.startsWith("exilus") && state.exilusSlot) {
    state.exilusSlot = { ...state.exilusSlot, mod }
  } else {
    const idx = parseInt(id.replace("normal-", ""))
    if (!isNaN(idx)) {
      state.normalSlots = [...state.normalSlots]
      state.normalSlots[idx] = { ...state.normalSlots[idx], mod }
    }
  }
}

function updateModRankInSlot(
  slot: ModSlot | undefined,
  newRank: number,
): ModSlot | undefined {
  if (!slot?.mod) return slot
  const clampedRank = Math.max(0, Math.min(newRank, slot.mod.fusionLimit))
  return { ...slot, mod: { ...slot.mod, rank: clampedRank } }
}

function buildReducer(state: BuildState, action: BuildAction): BuildState {
  switch (action.type) {
    case "PLACE_MOD": {
      const { mod, rank, slotId } = action
      const placedMod = toPlacedMod(mod, rank)

      const newState = { ...state }
      const baseName = getModBaseName(mod.name)

      // Remove existing instance of this mod or its variants
      newState.auraSlots = newState.auraSlots.map((s: ModSlot) =>
        s.mod && getModBaseName(s.mod.name) === baseName
          ? { ...s, mod: undefined }
          : s,
      )
      if (
        newState.exilusSlot?.mod &&
        getModBaseName(newState.exilusSlot.mod.name) === baseName
      ) {
        newState.exilusSlot = { ...newState.exilusSlot, mod: undefined }
      }
      newState.normalSlots = newState.normalSlots.map((s: ModSlot) =>
        s.mod && getModBaseName(s.mod.name) === baseName
          ? { ...s, mod: undefined }
          : s,
      )

      // Place in target slot
      setModInSlot(slotId, placedMod, newState)

      return newState
    }

    case "MOVE_MOD": {
      const { sourceSlotId, targetSlotId } = action
      const newState = { ...state }

      newState.auraSlots = newState.auraSlots.map((s) => ({ ...s }))
      if (newState.exilusSlot) newState.exilusSlot = { ...newState.exilusSlot }
      newState.normalSlots = [...newState.normalSlots]

      const sourceMod = getModFromSlot(sourceSlotId, newState)
      const targetMod = getModFromSlot(targetSlotId, newState)

      setModInSlot(sourceSlotId, targetMod, newState)
      setModInSlot(targetSlotId, sourceMod, newState)

      return newState
    }

    case "REMOVE_MOD": {
      const { slotId } = action
      const newState = { ...state }
      setModInSlot(slotId, undefined, newState)
      return newState
    }

    case "CHANGE_RANK": {
      const { slotId, newRank } = action
      const newState = { ...state }

      if (slotId.startsWith("aura-")) {
        const idx = parseInt(slotId.slice("aura-".length))
        if (idx >= 0 && idx < newState.auraSlots.length) {
          newState.auraSlots = [...newState.auraSlots]
          newState.auraSlots[idx] = updateModRankInSlot(newState.auraSlots[idx], newRank)!
        }
      } else if (slotId.startsWith("exilus") && newState.exilusSlot) {
        newState.exilusSlot = updateModRankInSlot(newState.exilusSlot, newRank)!
      } else {
        const slotIndex = parseInt(slotId.replace("normal-", ""))
        if (!isNaN(slotIndex)) {
          newState.normalSlots = [...newState.normalSlots]
          newState.normalSlots[slotIndex] = updateModRankInSlot(
            newState.normalSlots[slotIndex],
            newRank,
          )!
        }
      }

      return newState
    }

    case "APPLY_FORMA": {
      const { slotId, polarity } = action
      const newState = { ...state }

      const getFormaValue = (
        innate: Polarity | undefined,
      ): Polarity | undefined => {
        if (polarity === innate) return undefined
        if (polarity === "universal" && innate === undefined) return undefined
        return polarity
      }

      if (slotId.startsWith("aura-")) {
        const idx = parseInt(slotId.slice("aura-".length))
        if (idx >= 0 && idx < newState.auraSlots.length) {
          const formaValue = getFormaValue(newState.auraSlots[idx].innatePolarity)
          newState.auraSlots = [...newState.auraSlots]
          newState.auraSlots[idx] = { ...newState.auraSlots[idx], formaPolarity: formaValue }
        }
      } else if (slotId.startsWith("exilus") && newState.exilusSlot) {
        const formaValue = getFormaValue(newState.exilusSlot.innatePolarity)
        newState.exilusSlot = {
          ...newState.exilusSlot,
          formaPolarity: formaValue,
        }
      } else {
        const slotIndex = parseInt(slotId.replace("normal-", ""))
        if (!isNaN(slotIndex)) {
          newState.normalSlots = [...newState.normalSlots]
          const slot = newState.normalSlots[slotIndex]
          const formaValue = getFormaValue(slot.innatePolarity)
          newState.normalSlots[slotIndex] = {
            ...slot,
            formaPolarity: formaValue,
          }
        }
      }

      return newState
    }

    case "TOGGLE_REACTOR": {
      const maxLevel = state.maxLevelCap ?? 30
      return {
        ...state,
        hasReactor: !state.hasReactor,
        baseCapacity: !state.hasReactor ? maxLevel * 2 : maxLevel,
      }
    }

    case "CLEAR_BUILD": {
      return createInitialBuildState(
        action.item,
        action.category,
        action.compatibleMods,
      )
    }

    case "SET_HELMINTH": {
      const { slotIndex, ability } = action
      return {
        ...state,
        helminthAbility: ability ? { slotIndex, ability } : undefined,
      }
    }

    case "PLACE_ARCANE": {
      const { arcane, rank, slotIndex } = action
      const placedArcane: PlacedArcane = {
        uniqueName: arcane.uniqueName,
        name: arcane.name,
        imageName: arcane.imageName,
        rank,
        rarity: arcane.rarity,
      }

      const newArcaneSlots = [...(state.arcaneSlots || [])]
      const existingIndex = newArcaneSlots.findIndex(
        (a) => a?.uniqueName === arcane.uniqueName,
      )
      if (existingIndex !== -1 && existingIndex !== slotIndex) {
        newArcaneSlots[existingIndex] = null
      }
      newArcaneSlots[slotIndex] = placedArcane

      return { ...state, arcaneSlots: newArcaneSlots }
    }

    case "MOVE_ARCANE": {
      const { sourceIndex, targetIndex } = action
      const newArcaneSlots = [...(state.arcaneSlots || [])]
      const sourceArcane = newArcaneSlots[sourceIndex]
      const targetArcane = newArcaneSlots[targetIndex]
      newArcaneSlots[sourceIndex] = targetArcane
      newArcaneSlots[targetIndex] = sourceArcane
      return { ...state, arcaneSlots: newArcaneSlots }
    }

    case "REMOVE_ARCANE": {
      const newArcaneSlots = [...(state.arcaneSlots || [])]
      newArcaneSlots[action.slotIndex] = null
      return { ...state, arcaneSlots: newArcaneSlots }
    }

    case "CHANGE_ARCANE_RANK": {
      const { slotIndex, newRank } = action
      const newArcaneSlots = [...(state.arcaneSlots || [])]
      const arcane = newArcaneSlots[slotIndex]
      if (arcane) {
        const maxRank = 5
        const clampedRank = Math.max(0, Math.min(newRank, maxRank))
        newArcaneSlots[slotIndex] = { ...arcane, rank: clampedRank }
      }
      return { ...state, arcaneSlots: newArcaneSlots }
    }

    case "PLACE_SHARD": {
      const newShardSlots = [
        ...(state.shardSlots || [null, null, null, null, null]),
      ]
      newShardSlots[action.slotIndex] = action.shard
      return { ...state, shardSlots: newShardSlots }
    }

    case "REMOVE_SHARD": {
      const newShardSlots = [
        ...(state.shardSlots || [null, null, null, null, null]),
      ]
      newShardSlots[action.slotIndex] = null
      return { ...state, shardSlots: newShardSlots }
    }

    case "HYDRATE": {
      const { state: partial, item, category } = action
      return {
        ...state,
        ...partial,
        itemUniqueName: item.uniqueName,
        itemName: item.name,
        itemCategory: category,
        itemImageName: item.imageName,
      }
    }

    default:
      return state
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseBuildStateProps {
  item: BrowseableItem
  category: BrowseCategory
  compatibleMods: Mod[]
  compatibleArcanes: Arcane[]
  importedBuild?: Partial<BuildState>
  helminthAugmentMods?: Record<string, Mod[]>
}

export function useBuildState({
  item,
  category,
  compatibleMods,
  compatibleArcanes,
  importedBuild,
  helminthAugmentMods,
}: UseBuildStateProps) {
  const [buildState, dispatch] = useReducer(
    buildReducer,
    { item, category, compatibleMods, compatibleArcanes, importedBuild, helminthAugmentMods },
    (init) =>
      createInitialBuildState(
        init.item,
        init.category,
        init.compatibleMods,
        init.importedBuild,
        init.compatibleArcanes,
        init.helminthAugmentMods,
      ),
  )

  // --- Mod actions ---

  const placeModInSlot = useCallback(
    (mod: Mod, rank: number, slotId: string) => {
      dispatch({ type: "PLACE_MOD", mod, rank, slotId })
    },
    [],
  )

  const moveMod = useCallback((sourceSlotId: string, targetSlotId: string) => {
    dispatch({ type: "MOVE_MOD", sourceSlotId, targetSlotId })
  }, [])

  const handleRemoveMod = useCallback((slotId: string) => {
    dispatch({ type: "REMOVE_MOD", slotId })
  }, [])

  const handleChangeRank = useCallback((slotId: string, newRank: number) => {
    dispatch({ type: "CHANGE_RANK", slotId, newRank })
  }, [])

  const handleApplyForma = useCallback((slotId: string, polarity: Polarity) => {
    dispatch({ type: "APPLY_FORMA", slotId, polarity })
  }, [])

  const handleToggleReactor = useCallback(() => {
    dispatch({ type: "TOGGLE_REACTOR" })
  }, [])

  const handleClearBuild = useCallback(() => {
    dispatch({ type: "CLEAR_BUILD", item, category, compatibleMods })
  }, [item, category, compatibleMods])

  const handleHelminthAbilityChange = useCallback(
    (slotIndex: number, ability: HelminthAbility | null) => {
      dispatch({ type: "SET_HELMINTH", slotIndex, ability })
    },
    [],
  )

  // --- Arcane actions ---

  const placeArcaneInSlot = useCallback(
    (arcane: Arcane, rank: number, slotIndex: number) => {
      dispatch({ type: "PLACE_ARCANE", arcane, rank, slotIndex })
    },
    [],
  )

  const moveArcane = useCallback((sourceIndex: number, targetIndex: number) => {
    dispatch({ type: "MOVE_ARCANE", sourceIndex, targetIndex })
  }, [])

  const handleRemoveArcane = useCallback((slotIndex: number) => {
    dispatch({ type: "REMOVE_ARCANE", slotIndex })
  }, [])

  const handleChangeArcaneRank = useCallback(
    (slotIndex: number, newRank: number) => {
      dispatch({ type: "CHANGE_ARCANE_RANK", slotIndex, newRank })
    },
    [],
  )

  // --- Shard actions ---

  const handlePlaceShard = useCallback(
    (slotIndex: number, shard: PlacedShard) => {
      dispatch({ type: "PLACE_SHARD", slotIndex, shard })
    },
    [],
  )

  const handleRemoveShard = useCallback((slotIndex: number) => {
    dispatch({ type: "REMOVE_SHARD", slotIndex })
  }, [])

  // --- Derived state ---

  const usedModNames = useMemo((): Set<string> => {
    const names = new Set<string>()
    for (const slot of buildState.auraSlots) {
      if (slot.mod) names.add(getModBaseName(slot.mod.name))
    }
    if (buildState.exilusSlot?.mod)
      names.add(getModBaseName(buildState.exilusSlot.mod.name))
    for (const slot of buildState.normalSlots) {
      if (slot.mod) names.add(getModBaseName(slot.mod.name))
    }
    return names
  }, [buildState])

  const usedArcaneNames = useMemo((): Set<string> => {
    const names = new Set<string>()
    for (const a of buildState.arcaneSlots || []) {
      if (a !== null) names.add(a.name)
    }
    return names
  }, [buildState.arcaneSlots])

  const arcaneDataMap = useMemo(() => {
    const map = new Map<string, Arcane>()
    for (const arcane of compatibleArcanes) {
      map.set(arcane.uniqueName, arcane)
    }
    return map
  }, [compatibleArcanes])

  const { capacityStatus, totalEndoCost, formaCount } = useMemo(
    () => ({
      capacityStatus: getCapacityStatus(buildState),
      totalEndoCost: calculateTotalEndoCost(buildState),
      formaCount: calculateFormaCount(
        buildState.normalSlots,
        buildState.auraSlots,
        buildState.exilusSlot,
      ),
    }),
    [buildState],
  )

  return {
    buildState,
    dispatch,

    placeModInSlot,
    moveMod,
    handleRemoveMod,
    handleChangeRank,
    handleApplyForma,
    handleToggleReactor,
    handleClearBuild,
    handleHelminthAbilityChange,

    placeArcaneInSlot,
    moveArcane,
    handleRemoveArcane,
    handleChangeArcaneRank,

    handlePlaceShard,
    handleRemoveShard,

    usedModNames,
    usedArcaneNames,
    arcaneDataMap,
    capacityStatus,
    totalEndoCost,
    formaCount,
  }
}
