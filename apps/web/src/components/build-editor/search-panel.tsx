import type { HelminthAbility } from "@arsenyx/shared/warframe/build-data"
import {
  getAugmentAbility,
  getModsForItem,
  getPlexusSlotKind,
  isPlexusAuraMod,
  isStanceMod,
  type PlexusSlotKind,
} from "@arsenyx/shared/warframe/mods"
import {
  createSyntheticRiven,
  isRivenEligible,
} from "@arsenyx/shared/warframe/rivens"
import type { Mod, BrowseCategory } from "@arsenyx/shared/warframe/types"
import { useSuspenseQuery } from "@tanstack/react-query"
import { useEffect, useMemo, useState } from "react"

import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { hasLockedStance } from "@/lib/build/layout"
import { PLEXUS_GROUPS, type PlexusPickerState } from "@/lib/build/plexus"
import type { ModSlotKind } from "@/lib/build/slot-id"
import type { DetailItem } from "@/lib/catalog"
import { modsQuery } from "@/lib/queries/mods-query"

import { ModSearchGrid } from "./mod-search-grid"

export function SearchPanel({
  item,
  category,
  usedModNames,
  conflictUniqueNames,
  onSelect,
  selectedSlotKind,
  selectedSlot,
  plexus,
  helminth,
  alternateMode,
}: {
  item: DetailItem
  category: BrowseCategory
  usedModNames: Set<string>
  /** uniqueNames of mods mutually exclusive with an equipped mod — dimmed in
   *  the picker. */
  conflictUniqueNames: Set<string>
  onSelect: (mod: Mod) => void
  selectedSlotKind?: ModSlotKind
  /** Active slot id (or null). Drives the tab auto-sync — depending on
   * the id (not the derived group) lets us re-sync when the user moves
   * between same-group slots after a manual tab override. */
  selectedSlot?: string | null
  /** Railjack only: the active slot's group and per-group fill counts. */
  plexus?: PlexusPickerState
  helminth: Record<number, HelminthAbility>
  /** Set while picking a Slot's Alternate: a pick sets the Alternate instead
   *  of placing a mod, so the panel says so loudly and hides the Riven card
   *  (a Riven is never an Alternate). */
  alternateMode?: { forModName: string; onCancel: () => void }
}) {
  const { data: allMods } = useSuspenseQuery(modsQuery)

  // Tabs replace the slot-driven picker filter on Plexus: clicking a slot
  // syncs the tab, clicking a tab narrows the mod pool. Selected slot's
  // group still drives placement (Matrix auto-routes to aura via
  // canPlaceIn), so the tab is purely a picker affordance.
  const [plexusTab, setPlexusTab] = useState<PlexusSlotKind>(
    plexus?.group ?? "integrated",
  )
  useEffect(() => {
    // Depend on the slot id (not the derived group) so that re-selecting
    // a different slot in the same group after a manual tab override
    // still re-syncs the tab.
    if (plexus?.group) setPlexusTab(plexus.group)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [category, selectedSlot])

  const compatible = useMemo(() => {
    const base = getModsForItem(
      {
        uniqueName: item.uniqueName,
        modPools: item.modPools,
        compatTags: item.compatTags,
        trigger: item.trigger,
      },
      allMods,
    )
    if (category === "railjack") {
      // Aura slot active on the Integrated tab → show only Matrix mods.
      // Otherwise tab is the sole pool filter (Integrated still includes
      // Matrix; canPlaceIn auto-routes them to the Aura slot on placement).
      if (plexusTab === "integrated" && plexus?.isAura) {
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
      const abilityName = ability.name.toLowerCase()
      for (const m of allMods) {
        if (!m.isAugment) continue
        if ((m.compatName ?? "").toLowerCase() !== source) continue
        if (getAugmentAbility(m)?.toLowerCase() !== abilityName) continue
        extras.push(m)
      }
    }
    // Locked-stance exalted weapons (Exalted Blade, Desert Wind, …) keep their
    // stance permanently — the slot is read-only and pre-filled — so drop any
    // stance mods from the picker. Without this, a class-matching stance (e.g.
    // a Sword stance for Exalted Blade) would route into the locked slot and
    // silently vanish from the render while polluting the saved build.
    const all = [...base, ...extras]
    const usable = hasLockedStance(item, category)
      ? all.filter((m) => !isStanceMod(m))
      : all
    if (isRivenEligible(category, item) && !alternateMode) {
      return [createSyntheticRiven(), ...usable]
    }
    return usable
  }, [
    allMods,
    item,
    category,
    helminth,
    plexusTab,
    plexus?.isAura,
    alternateMode,
  ])

  return (
    <div className="flex flex-col gap-3">
      {alternateMode && (
        <div
          role="status"
          className="border-primary/40 bg-primary/10 flex items-center justify-between gap-3 rounded-md border px-3 py-2 text-sm"
        >
          <span>
            Picking an <strong>alternate</strong> for{" "}
            <strong>{alternateMode.forModName}</strong>. It won't replace the
            slot's mod.
          </span>
          <Button size="sm" variant="ghost" onClick={alternateMode.onCancel}>
            Cancel
          </Button>
        </div>
      )}
      {category === "railjack" && (
        <Tabs
          value={plexusTab}
          onValueChange={(v) => setPlexusTab(v as PlexusSlotKind)}
        >
          <TabsList>
            {PLEXUS_GROUPS.map((g) => {
              const counts = plexus?.fillCounts[g.kind]
              return (
                <TabsTrigger key={g.kind} value={g.kind}>
                  {g.label}
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
        conflictUniqueNames={conflictUniqueNames}
        onSelect={onSelect}
        selectedSlotKind={selectedSlotKind}
      />
    </div>
  )
}
