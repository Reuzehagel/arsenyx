"use client"

import type { Mod, Arcane, BrowseCategory } from "@/lib/warframe/types"

import { ArcaneSearchPanel } from "./arcane-search-panel"
import type { DragItem } from "./hooks/use-build-state"
import { ModSearchGrid } from "./mod-search-grid"

export interface BuildEditorSearchPanelProps {
  activeSlotId: string | null
  activeDragItem: DragItem | null
  compatibleArcanes: Arcane[]
  compatibleMods: Mod[]
  usedArcaneNames: Set<string>
  usedModNames: Set<string>
  onPlaceArcane: (arcane: Arcane, rank: number) => void
  onPlaceMod: (mod: Mod, rank?: number) => void
  itemCategory: BrowseCategory
}

function getSlotType(
  slotId: string | null,
): "aura" | "exilus" | "normal" | "arcane" {
  if (!slotId) return "normal"
  if (slotId.startsWith("aura")) return "aura"
  if (slotId.startsWith("exilus")) return "exilus"
  if (slotId.startsWith("arcane")) return "arcane"
  return "normal"
}

export function BuildEditorSearchPanel({
  activeSlotId,
  activeDragItem,
  compatibleArcanes,
  compatibleMods,
  usedArcaneNames,
  usedModNames,
  onPlaceArcane,
  onPlaceMod,
  itemCategory,
}: BuildEditorSearchPanelProps) {
  return (
    <div className="bg-card rounded-lg border p-4">
      {(getSlotType(activeSlotId) === "arcane" ||
        activeDragItem?.type === "search-arcane" ||
        activeDragItem?.type === "placed-arcane") &&
      compatibleArcanes.length > 0 ? (
        <ArcaneSearchPanel
          availableArcanes={compatibleArcanes}
          usedArcaneNames={usedArcaneNames}
          onSelectArcane={onPlaceArcane}
        />
      ) : (
        <ModSearchGrid
          availableMods={compatibleMods}
          slotType={getSlotType(activeSlotId)}
          usedModNames={usedModNames}
          onSelectMod={onPlaceMod}
          itemCategory={itemCategory}
        />
      )}
    </div>
  )
}
