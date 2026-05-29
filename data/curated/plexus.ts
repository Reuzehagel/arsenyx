/**
 * Synthetic Plexus weapon. DE doesn't export it as a standalone entry, so
 * we curate one here.
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
  // Resolved from DE manifest entry for /Lotus/Upgrades/Skins/RailJack/RailjackWrasseSkin.
  imageName:
    "https://content.warframe.com/PublicExport/Lotus/Interface/Icons/StoreIcons/PlayerShip/Ships/RailjackWrasseSkin.png!00_avatybGG8ADR-dgGnKJNkw",
  isPrime: false,
  displayClass: "Plexus",
}

export const PLEXUS_DETAIL = {
  uniqueName: PLEXUS_UNIQUE_NAME,
  name: "Plexus",
  slug: PLEXUS_SLUG,
  category: "railjack",
  type: "Plexus",
  displayClass: "Plexus",
  modPools: ["Plexus"],
  // Resolved from DE manifest entry for /Lotus/Upgrades/Skins/RailJack/RailjackWrasseSkin.
  imageName:
    "https://content.warframe.com/PublicExport/Lotus/Interface/Icons/StoreIcons/PlayerShip/Ships/RailjackWrasseSkin.png!00_avatybGG8ADR-dgGnKJNkw",
  description:
    "Personal modular Railjack loadout. Houses Battle, Tactical, and Integrated mods that travel with you between ships.",
  tradable: false,
}
