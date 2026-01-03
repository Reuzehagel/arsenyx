/**
 * Mod Card Configuration
 *
 * Centralizes all positioning, sizing, and asset mapping for mod cards.
 * This eliminates scattered magic pixel values and makes the system maintainable.
 */

// =============================================================================
// RARITY TYPES AND GROUPINGS
// =============================================================================

export type ModRarity =
  | "Common"
  | "Uncommon"
  | "Rare"
  | "Legendary"
  | "Peculiar"
  | "Riven"
  | "Amalgam"
  | "Galvanized";

/**
 * Rarity groups based on asset structure.
 * Different groups have different frame dimensions and require different scaling.
 */
export type RarityGroup =
  | "standard"
  | "legendary"
  | "riven"
  | "amalgam"
  | "galvanized";

/**
 * Map each rarity to its asset group and folder/prefix for loading images.
 */
export const RARITY_CONFIG: Record<
  ModRarity,
  {
    group: RarityGroup;
    folder: string;
    prefix: string;
    textColor: string;
  }
> = {
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
};

// =============================================================================
// ASSET DIMENSIONS (Source PNG sizes)
// =============================================================================

/**
 * Original PNG dimensions per rarity group.
 * Used to calculate scale factors.
 */
export const ASSET_DIMENSIONS: Record<
  RarityGroup,
  {
    background: { w: number; h: number };
    frameTop: { w: number; h: number };
    frameBottom: { w: number; h: number };
  }
> = {
  standard: {
    background: { w: 242, h: 338 },
    frameTop: { w: 248, h: 41 },
    frameBottom: { w: 252, h: 85 },
  },
  legendary: {
    background: { w: 242, h: 338 },
    frameTop: { w: 248, h: 41 },
    frameBottom: { w: 252, h: 111 },
  },
  riven: {
    background: { w: 242, h: 338 },
    frameTop: { w: 281, h: 117 },
    frameBottom: { w: 292, h: 120 },
  },
  amalgam: {
    background: { w: 242, h: 338 },
    frameTop: { w: 279, h: 94 },
    frameBottom: { w: 274, h: 94 },
  },
  galvanized: {
    background: { w: 256, h: 512 },
    frameTop: { w: 512, h: 128 },
    frameBottom: { w: 512, h: 256 },
  },
};

// =============================================================================
// DISPLAY SIZES
// =============================================================================

/**
 * Display sizes for compact and expanded variants.
 * All rarities are normalized to the same display width.
 */
export const DISPLAY_SIZE = {
  compact: { width: 184, height: 64 },
  expanded: { width: 184, height: 285 },
} as const;

export type CardVariant = keyof typeof DISPLAY_SIZE;

// =============================================================================
// ASSET URL HELPERS
// =============================================================================

/**
 * Get the URL for a mod card asset.
 */
export function getModAssetUrl(
  rarity: ModRarity,
  asset:
    | "Background"
    | "FrameTop"
    | "FrameBottom"
    | "CornerLights"
    | "SideLight"
    | "LowerTab"
    | "TopRightBacker"
    | "RankCompleteLine"
): string {
  const config = RARITY_CONFIG[rarity];

  // Special case: RankCompleteLine doesn't have a prefix
  if (asset === "RankCompleteLine") {
    return `/mod-components/${config.folder}/RankCompleteLine.png`;
  }

  // Special case: Amalgam uses different prefixes for some assets
  if (rarity === "Amalgam") {
    // Amalgam uses Legendary corner lights and Silver lower tab/backer
    if (asset === "CornerLights" || asset === "SideLight") {
      return `/mod-components/${config.folder}/Legendary${asset}.png`;
    }
    if (asset === "LowerTab" || asset === "TopRightBacker") {
      return `/mod-components/${config.folder}/Silver${asset}.png`;
    }
  }

  // Special case: Galvanized uses Silver for some assets
  if (rarity === "Galvanized") {
    if (asset === "LowerTab" || asset === "TopRightBacker") {
      return `/mod-components/${config.folder}/Silver${asset}.png`;
    }
  }

  // Special case: Riven uses Silver background
  if (rarity === "Riven" && asset === "Background") {
    return `/mod-components/${config.folder}/SilverBackground.png`;
  }

  return `/mod-components/${config.folder}/${config.prefix}${asset}.png`;
}

/**
 * Get the text color for a rarity.
 */
export function getRarityColor(rarity: ModRarity): string {
  return RARITY_CONFIG[rarity].textColor;
}

/**
 * Get the rarity group for a rarity.
 */
export function getRarityGroup(rarity: ModRarity): RarityGroup {
  return RARITY_CONFIG[rarity].group;
}

// =============================================================================
// POLARITY ICONS
// =============================================================================

import type { Polarity } from "./types";

const POLARITY_ICON_MAP: Record<Polarity, string> = {
  madurai: "Madurai_Pol.svg",
  vazarin: "Vazarin_Pol.svg",
  naramon: "Naramon_Pol.svg",
  zenurik: "Zenurik_Pol.svg",
  unairu: "Unairu_Pol.svg",
  penjaga: "Penjaga_Pol.svg",
  umbra: "Umbra_Pol.svg",
  universal: "Any_Pol.svg",
};

export function getPolarityIconUrl(polarity: Polarity): string {
  const filename = POLARITY_ICON_MAP[polarity] || "Any_Pol.svg";
  return `/focus-schools/${filename}`;
}

// =============================================================================
// ANIMATION CONFIG
// =============================================================================

/**
 * Framer Motion transition config for the hover animation.
 */
export const HOVER_TRANSITION = {
  type: "tween" as const,
  duration: 0.15,
  ease: [0.4, 0, 0.2, 1], // ease-out cubic
};
