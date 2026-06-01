import type { BrowseCategory } from "./types"

// Pure, category-only slot-layout facts. Shared because both the web editor
// and the api Overframe importer need them. Item-dependent layout (aura count
// from `item.aura`, stance from `stancePolarity`, arcane pools, etc.) stays in
// the web editor's `layout.ts` — those need the resolved item, not just a
// category.

/** Normal mod slot count. Companions have 10, necramechs have 12, the Plexus
 *  has 14 (3 Battle + 3 Tactical + 8 Integrated; its 1 Aura is counted
 *  separately), everything else 8. */
export function getNormalSlotCount(category: BrowseCategory): number {
  if (category === "companions") return 10
  if (category === "necramechs") return 12
  if (category === "railjack") return 14
  return 8
}

/** Categories that have an Exilus slot. Necramechs, companions, companion
 *  weapons, every archwing-category item (suits, arch-guns, arch-melee), and
 *  the railjack Plexus don't. Robotic/Sentinel weapons have no Exilus slot
 *  (and can't take Arcanes); beast claws carry a Posture (stance) slot instead
 *  — neither variety of companion weapon has an Exilus slot.
 *  (wiki.warframe.com/w/Sentinel: "Robotic weapons do not possess an Exilus
 *  slot and cannot equip Arcane Enhancements.") */
export function hasExilusSlot(category: BrowseCategory): boolean {
  return (
    category !== "necramechs" &&
    category !== "companions" &&
    category !== "companion-weapons" &&
    category !== "archwing" &&
    category !== "railjack"
  )
}

/** Warframes and necramechs share the "aura at slot_id 9, exilus at 10" layout
 *  used when interpreting Overframe slot ids. */
export function isWarframeLike(category: BrowseCategory): boolean {
  return category === "warframes" || category === "necramechs"
}
