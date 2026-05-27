/**
 * Synthetic Plexus weapon. DE doesn't export it as a standalone entry, so
 * we curate one here. Moved from scripts/build-items-index.ts in Phase 4.
 */

import type { BrowseItem } from "@arsenyx/shared/warframe/types"

const PLEXUS_UNIQUE_NAME = "/Lotus/Railjacks/Plexus"
const PLEXUS_SLUG = "plexus"

export const PLEXUS_BROWSE_ITEM: BrowseItem = {
  uniqueName: PLEXUS_UNIQUE_NAME,
  name: "Plexus",
  slug: PLEXUS_SLUG,
  category: "railjack",
  // Reuse the Caballero Railjack Skin asset — closest available ship-themed
  // image. Same source the legacy build used.
  imageName: "RailjackWrasseSkin.png",
  isPrime: false,
  type: "Plexus",
}

export const PLEXUS_DETAIL = {
  uniqueName: PLEXUS_UNIQUE_NAME,
  name: "Plexus",
  slug: PLEXUS_SLUG,
  category: "railjack",
  type: "Plexus",
  displayClass: "Plexus",
  modPools: ["Plexus"],
  imageName: "RailjackWrasseSkin.png",
  description:
    "Personal modular Railjack loadout. Houses Battle, Tactical, and Integrated mods that travel with you between ships.",
  tradable: false,
}
