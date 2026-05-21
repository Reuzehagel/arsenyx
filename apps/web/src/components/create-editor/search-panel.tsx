import { getModsForItem } from "@arsenyx/shared/warframe/mods"
import {
  createSyntheticRiven,
  isRivenEligible,
} from "@arsenyx/shared/warframe/rivens"
import { type Mod } from "@arsenyx/shared/warframe/types"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useMemo } from "react"

import { ModSearchGrid, type ModSlotKind } from "@/components/build-editor"
import { type HelminthAbility } from "@/lib/helminth-query"
import { modsQuery } from "@/lib/mods-query"
import { type BrowseCategory, type DetailItem } from "@/lib/warframe"

export function SearchPanel({
  item,
  category,
  usedModNames,
  onSelect,
  selectedSlotKind,
  helminth,
}: {
  item: DetailItem
  category: BrowseCategory
  usedModNames: Set<string>
  onSelect: (mod: Mod) => void
  selectedSlotKind?: ModSlotKind
  helminth: Record<number, HelminthAbility>
}) {
  const { data: allMods } = useSuspenseQuery(modsQuery)
  const compatible = useMemo(() => {
    const base = getModsForItem(
      {
        type: item.type,
        category: item.category,
        name: item.name,
      },
      allMods,
    )
    // Augments for subsumed abilities belong to a different warframe's
    // `compatName`, so `getModsForItem` filters them out. Stitch them back
    // in by matching source warframe + "<Ability> Augment:" description prefix.
    const extras: Mod[] = []
    for (const ability of Object.values(helminth)) {
      const source = ability.source.toLowerCase()
      const prefix = `${ability.name.toLowerCase()} augment:`
      for (const m of allMods) {
        if (!m.isAugment) continue
        if ((m.compatName ?? "").toLowerCase() !== source) continue
        const desc = (m.levelStats?.[0]?.stats?.[0] ?? "").toLowerCase()
        if (!desc.startsWith(prefix)) continue
        extras.push(m)
      }
    }
    const mods = [...base, ...extras]
    if (isRivenEligible(category, item)) {
      return [createSyntheticRiven(), ...mods]
    }
    return mods
  }, [allMods, item, category, helminth])

  return (
    <ModSearchGrid
      mods={compatible}
      usedModNames={usedModNames}
      onSelect={onSelect}
      selectedSlotKind={selectedSlotKind}
    />
  )
}
