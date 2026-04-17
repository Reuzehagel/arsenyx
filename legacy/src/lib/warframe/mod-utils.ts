import type { Mod, PlacedMod } from "./types"

export function toPlacedMod(mod: Mod, rank: number): PlacedMod {
  return {
    uniqueName: mod.uniqueName,
    name: mod.name,
    imageName: mod.imageName,
    polarity: mod.polarity,
    baseDrain: mod.baseDrain,
    fusionLimit: mod.fusionLimit,
    rank,
    rarity: mod.rarity,
    compatName: mod.compatName,
    type: mod.type,
    levelStats: mod.levelStats,
    modSet: mod.modSet,
    modSetStats: mod.modSetStats,
    isExilus: mod.isExilus,
    isUtility: mod.isUtility,
  }
}
