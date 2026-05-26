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
    return `/mod-components/${config.folder}/RankCompleteLine.webp`
  }

  // Amalgam borrows Legendary corner/side lights and Silver lower tab/backer.
  if (rarity === "Amalgam") {
    if (asset === "CornerLights" || asset === "SideLight") {
      return `/mod-components/${config.folder}/Legendary${asset}.webp`
    }
    if (asset === "LowerTab" || asset === "TopRightBacker") {
      return `/mod-components/${config.folder}/Silver${asset}.webp`
    }
  }

  // Galvanized borrows Silver lower tab/backer.
  if (
    rarity === "Galvanized" &&
    (asset === "LowerTab" || asset === "TopRightBacker")
  ) {
    return `/mod-components/${config.folder}/Silver${asset}.webp`
  }

  // Riven uses Silver background texture.
  if (rarity === "Riven" && asset === "Background") {
    return `/mod-components/${config.folder}/SilverBackground.webp`
  }

  return `/mod-components/${config.folder}/${config.prefix}${asset}.webp`
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

// --- Slot-type and set badge icons (top-center of a mod card) ---

export type SlotBadgeKind = "aura" | "exilus" | "stance"

// Wiki CDN paths — same approach as arcane-images.ts. We render via
// CSS mask-image so the icons take any color (rarity-tinted).
const SLOT_BADGE_URL: Record<SlotBadgeKind, string> = {
  // IconAura(xWhite) / IconStance(xWhite) — solid white silhouettes.
  aura: "https://wiki.warframe.com/images/IconAura%28xWhite%29.png",
  // The wiki only ships a black variant of the Exilus glyph; mask-image
  // discards the source color so the black PNG still tints correctly.
  exilus: "https://wiki.warframe.com/images/Exilus_icon%28xBlack%29.png",
  stance: "https://wiki.warframe.com/images/IconStance%28xWhite%29.png",
}

export function getSlotBadgeUrl(kind: SlotBadgeKind): string {
  return SLOT_BADGE_URL[kind]
}

/** Set crest URL — sourced from WFCD's `warframe-items/data/img/*Header.png`
 * and bundled locally under `public/mod-set-icons/`. We ship the silver
 * source plus pre-tinted bronze and gold variants (generated offline by
 * `scripts/tint-set-crests.py`); a runtime `mask-image` tint would flatten
 * the source's grayscale shading into a single colour and look terrible.
 *
 * The internal `modSet` codename (from `getModSetCode`) IS the filename
 * stem (`Augur` → `AugurHeader.png`); the one alias is the Sacrificial
 * set, which appears in mod data under both `Sacrifice` and `Umbra` but
 * only ships as `UmbraHeader.png` upstream. */
const SET_CODE_ALIASES: Record<string, string> = {
  Sacrifice: "Umbra",
}

export function getSetIconUrl(
  setCode: string | null,
  rarity: ModRarity,
): string | null {
  if (!setCode) return null
  const stem = SET_CODE_ALIASES[setCode] ?? setCode
  // Silver source reads correctly on every rarity EXCEPT Common/Rare,
  // where it clashes with the bronze/gold framing — use the pre-tinted
  // variant for those two.
  const suffix =
    rarity === "Common" ? "-bronze" : rarity === "Rare" ? "-gold" : ""
  return `/mod-set-icons/${stem}Header${suffix}.png`
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
