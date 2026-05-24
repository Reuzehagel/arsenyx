import {
  getModsForItem,
  getPlexusSlotKind,
  isPlexusAuraMod,
  type PlexusSlotKind,
} from "@arsenyx/shared/warframe/mods"
import {
  createSyntheticRiven,
  isRivenEligible,
} from "@arsenyx/shared/warframe/rivens"
import { type Mod } from "@arsenyx/shared/warframe/types"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

import { ModSearchGrid, type ModSlotKind } from "@/components/build-editor"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { type HelminthAbility } from "@/lib/helminth-query"
import { modsQuery } from "@/lib/mods-query"
import { type BrowseCategory, type DetailItem } from "@/lib/warframe"

const PLEXUS_TABS: { value: PlexusSlotKind; label: string }[] = [
  { value: "integrated", label: "Integrated" },
  { value: "battle", label: "Battle" },
  { value: "tactical", label: "Tactical" },
]

export interface PlexusFillCounts {
  battle: { filled: number; total: number }
  tactical: { filled: number; total: number }
  integrated: { filled: number; total: number }
}

export function SearchPanel({
  item,
  category,
  usedModNames,
  onSelect,
  selectedSlotKind,
  selectedSlot,
  selectedPlexusGroup,
  selectedIsPlexusAura,
  plexusFillCounts,
  helminth,
}: {
  item: DetailItem
  category: BrowseCategory
  usedModNames: Set<string>
  onSelect: (mod: Mod) => void
  selectedSlotKind?: ModSlotKind
  /** Active slot id (or null). Drives the tab auto-sync — depending on
   * the id (not the derived group) lets us re-sync when the user moves
   * between same-group slots after a manual tab override. */
  selectedSlot?: string | null
  /** Slot-derived hint for the active Plexus tab. Aura slot maps to
   * `"integrated"`. */
  selectedPlexusGroup?: PlexusSlotKind
  /** When the Aura slot is the active slot on the Integrated tab, narrow
   * the visible mods to Aura/Matrix only. */
  selectedIsPlexusAura?: boolean
  /** Per-group filled-vs-total counts for the tab labels. */
  plexusFillCounts?: PlexusFillCounts
  helminth: Record<number, HelminthAbility>
}) {
  const { data: allMods } = useSuspenseQuery(modsQuery)

  // Tabs replace the slot-driven picker filter on Plexus: clicking a slot
  // syncs the tab, clicking a tab narrows the mod pool. Selected slot's
  // group still drives placement (Matrix auto-routes to aura via
  // canPlaceIn), so the tab is purely a picker affordance.
  const [plexusTab, setPlexusTab] = useState<PlexusSlotKind>(
    selectedPlexusGroup ?? "integrated",
  )
  useEffect(() => {
    // Depend on the slot id (not the derived group) so that re-selecting
    // a different slot in the same group after a manual tab override
    // still re-syncs the tab.
    if (category === "railjack" && selectedPlexusGroup) {
      setPlexusTab(selectedPlexusGroup)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, selectedSlot])

  const compatible = useMemo(() => {
    const base = getModsForItem(
      {
        type: item.type,
        category: item.category,
        name: item.name,
        trigger: item.trigger,
        meleeClass: item.meleeClass,
        uniqueName: item.uniqueName,
        compatGroups: item.compatGroups,
      },
      allMods,
    )
    if (category === "railjack") {
      // Aura slot active on the Integrated tab → show only Matrix mods.
      // Otherwise tab is the sole pool filter (Integrated still includes
      // Matrix; canPlaceIn auto-routes them to the Aura slot on placement).
      if (plexusTab === "integrated" && selectedIsPlexusAura) {
        return base.filter((m) => isPlexusAuraMod(m))
      }
      return base.filter((m) => getPlexusSlotKind(m) === plexusTab)
    }
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
  }, [allMods, item, category, helminth, plexusTab, selectedIsPlexusAura])

  return (
    <div className="flex flex-col gap-3">
      {category === "railjack" && (
        <Tabs
          value={plexusTab}
          onValueChange={(v) => setPlexusTab(v as PlexusSlotKind)}
        >
          <TabsList>
            {PLEXUS_TABS.map((t) => {
              const counts = plexusFillCounts?.[t.value]
              return (
                <TabsTrigger key={t.value} value={t.value}>
                  {t.label}
                  {counts && (
                    <span className="text-muted-foreground/70 ml-1.5 font-mono text-xs tabular-nums">
                      {counts.filled}/{counts.total}
                    </span>
                  )}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </Tabs>
      )}
      <ModSearchGrid
        mods={compatible}
        usedModNames={usedModNames}
        onSelect={onSelect}
        selectedSlotKind={selectedSlotKind}
      />
    </div>
  )
}
