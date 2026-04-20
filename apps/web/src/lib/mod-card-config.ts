/**
 * Mod-card rarity configuration.
 * Ported from legacy/src/lib/warframe/mod-card-config.ts — same asset layout
 * (assets under /public/mod-components and /public/focus-schools).
 *
 * Cleanups vs legacy:
 *  - No screenshot-mode branches (the screenshot artifact is a separate
 *    renderer, not a special prop on this component).
 *  - One polarity icon map, one asset URL resolver, one rarity text color.
 */

import type { Polarity } from "@arsenyx/shared/warframe/types"

export type ModRarity =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Legendary"
  | "Peculiar"
  | "Riven"
  | "Amalgam"
  | "Galvanized"

export type RarityGroup =
  | "standard"
  | "legendary"
  | "riven"
  | "amalgam"
  | "galvanized"

interface RarityConfig {
  group: RarityGroup
  folder: string
  prefix: string
  textColor: string
}

export const RARITY_CONFIG: Record<ModRarity, RarityConfig> = {
  Common: {
    group: "standard",
    folder: "common",
    prefix: "Bronze",
    textColor: "#C79989",
  },
  Uncommon: {
    group: "standard",
    folder: "uncommon",
    prefix: "Silver",
    textColor: "#BEC0C2",
  },
  Rare: {
    group: "standard",
    folder: "rare",
    prefix: "Gold",
    textColor: "#FBECC4",
  },
  Legendary: {
    group: "legendary",
    folder: "legendary",
    prefix: "Legendary",
    textColor: "#DFDFDF",
  },
  Peculiar: {
    group: "legendary",
    folder: "legendary",
    prefix: "Legendary",
    textColor: "#DFDFDF",
  },
  Riven: {
    group: "riven",
    folder: "riven",
    prefix: "Riven",
    textColor: "#D9A8FF",
  },
  Amalgam: {
    group: "amalgam",
    folder: "amalgam",
    prefix: "Amalgam",
    textColor: "#98D9EB",
  },
  Galvanized: {
    group: "galvanized",
    folder: "galvanized",
    prefix: "Galvanized",
    textColor: "#7CB8E4",
  },
}

export const DISPLAY_SIZE = {
  compact: { width: 184, height: 64 },
  expanded: { width: 184, height: 285 },
} as const

export type CardVariant = keyof typeof DISPLAY_SIZE

type AssetKind =
  | "Background"
  | "FrameTop"
  | "FrameBottom"
  | "CornerLights"
  | "SideLight"
  | "LowerTab"
  | "TopRightBacker"
  | "RankCompleteLine"

export function getModAssetUrl(rarity: ModRarity, asset: AssetKind): string {
  const config = RARITY_CONFIG[rarity]

  if (asset === "RankCompleteLine") {
    return `/mod-components/${config.folder}/RankCompleteLine.png`
  }

  // Amalgam borrows Legendary corner/side lights and Silver lower tab/backer.
  if (rarity === "Amalgam") {
    if (asset === "CornerLights" || asset === "SideLight") {
      return `/mod-components/${config.folder}/Legendary${asset}.png`
    }
    if (asset === "LowerTab" || asset === "TopRightBacker") {
      return `/mod-components/${config.folder}/Silver${asset}.png`
    }
  }

  // Galvanized borrows Silver lower tab/backer.
  if (
    rarity === "Galvanized" &&
    (asset === "LowerTab" || asset === "TopRightBacker")
  ) {
    return `/mod-components/${config.folder}/Silver${asset}.png`
  }

  // Riven uses Silver background texture.
  if (rarity === "Riven" && asset === "Background") {
    return `/mod-components/${config.folder}/SilverBackground.png`
  }

  return `/mod-components/${config.folder}/${config.prefix}${asset}.png`
}

export function getRarityColor(rarity: ModRarity): string {
  return RARITY_CONFIG[rarity].textColor
}

export function getRarityGroup(rarity: ModRarity): RarityGroup {
  return RARITY_CONFIG[rarity].group
}

const POLARITY_ICON_MAP: Record<Polarity, string> = {
  madurai: "Madurai_Pol.svg",
  vazarin: "Vazarin_Pol.svg",
  naramon: "Naramon_Pol.svg",
  zenurik: "Zenurik_Pol.svg",
  unairu: "Unairu_Pol.svg",
  penjaga: "Penjaga_Pol.svg",
  umbra: "Umbra_Pol.svg",
  any: "Any_Pol.svg",
  universal: "Any_Pol.svg",
}

export function getPolarityIconUrl(polarity: Polarity): string {
  const filename = POLARITY_ICON_MAP[polarity] ?? "Any_Pol.svg"
  return `/focus-schools/${filename}`
}

export function normalizeRarity(rarity?: string): ModRarity {
  const valid: ModRarity[] = [
    "Common",
    "Uncommon",
    "Rare",
    "Legendary",
    "Peculiar",
    "Riven",
    "Amalgam",
    "Galvanized",
  ]
  return valid.includes(rarity as ModRarity) ? (rarity as ModRarity) : "Common"
}
