"use client";

import { useState, useCallback, useEffect, useMemo, useRef, useId } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  DndContext,
  DragOverlay,
  useSensor,
  useSensors,
  PointerSensor,
  DragStartEvent,
  DragEndEvent,
  DragOverEvent,
} from "@dnd-kit/core";
import { ItemSidebar } from "./item-sidebar";
import { GuideEditorDialog } from "./guide-editor-dialog";
import { ModGrid } from "./mod-grid";
import { ModSearchGrid } from "./mod-search-grid";
import { CompactModCard, type ModRarity } from "@/components/mod-card";
import { useBuildKeyboard } from "./use-build-keyboard";
import {
  getCapacityStatus,
  calculateTotalEndoCost,
  calculateFormaCount,
} from "@/lib/warframe/capacity";
import { normalizePolarity } from "@/lib/warframe/mods";
import { copyBuildToClipboard } from "@/lib/build-codec";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { getImageUrl } from "@/lib/warframe/images";
import type {
  BuildState,
  ModSlot,
  PlacedMod,
  Polarity,
  BrowseCategory,
  BrowseableItem,
  Mod,
} from "@/lib/warframe/types";
import { Diamond, Gem, Save, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type DragItem =
  | { type: "search-mod"; mod: Mod; rank: number }
  | { type: "placed-mod"; mod: PlacedMod; slotId: string; rank?: number };

interface BuildContainerProps {
  item: BrowseableItem;
  category: BrowseCategory;
  categoryLabel: string;
  compatibleMods: Mod[];
  importedBuild?: Partial<BuildState>;
}

// Extract warframe stats from item data
interface ItemStats {
  health?: number;
  shield?: number;
  armor?: number;
  energy?: number;
  sprintSpeed?: number;
  abilities?: Array<{ name: string; imageName?: string }>;
}

function extractItemStats(item: BrowseableItem): ItemStats {
  const wf = item as {
    health?: number;
    shield?: number;
    armor?: number;
    power?: number;
    sprintSpeed?: number;
    abilities?: Array<{ name: string; imageName?: string }>;
  };
  return {
    health: wf.health,
    shield: wf.shield,
    armor: wf.armor,
    energy: wf.power,
    sprintSpeed: wf.sprintSpeed,
    abilities: wf.abilities,
  };
}

// Create initial mod slots with optional innate polarities
function createInitialSlots(polarities?: string[]): ModSlot[] {
  return Array.from({ length: 8 }, (_, i) => ({
    id: `normal-${i}`,
    type: "normal" as const,
    innatePolarity: polarities?.[i] ? normalizePolarity(polarities[i]) : undefined,
  }));
}

// Create initial build state
function createInitialBuildState(
  item: BrowseableItem,
  category: BrowseCategory,
  compatibleMods: Mod[],
  importedBuild?: Partial<BuildState>
): BuildState {
  const isWarframe = category === "warframes" || category === "necramechs";

  // Extract polarities from item data (weapons, warframes have these)
  const itemPolarities = (item as { polarities?: string[] }).polarities;
  const auraPolarity = (item as { aura?: string }).aura;

  const baseState: BuildState = {
    itemUniqueName: item.uniqueName,
    itemName: item.name,
    itemCategory: category,
    itemImageName: item.imageName,
    hasReactor: true,
    exilusSlot: { id: "exilus-0", type: "exilus" },
    normalSlots: createInitialSlots(itemPolarities),
    arcaneSlots: [],
    baseCapacity: 60,
    currentCapacity: 60,
    formaCount: 0,
  };

  // Add aura slot for warframes with innate aura polarity
  if (isWarframe) {
    baseState.auraSlot = {
      id: "aura-0",
      type: "aura",
      innatePolarity: auraPolarity ? normalizePolarity(auraPolarity) : undefined,
    };
    baseState.arcaneSlots = [];
  }

  // Apply imported build data if available
  if (importedBuild) {
    const hydratedState = {
      ...baseState,
      ...importedBuild,
      // Ensure these are always from base state
      itemUniqueName: item.uniqueName,
      itemName: item.name,
      itemCategory: category,
      itemImageName: item.imageName,
    };

    // Hydrate mods with full data (including levelStats)
    const hydrateSlot = (slot: ModSlot) => {
      if (slot.mod) {
        const fullMod = compatibleMods.find(
          (m) => m.uniqueName === slot.mod!.uniqueName
        );
        if (fullMod) {
          slot.mod = {
            ...slot.mod,
            name: fullMod.name,
            imageName: fullMod.imageName,
            polarity: fullMod.polarity,
            baseDrain: fullMod.baseDrain,
            fusionLimit: fullMod.fusionLimit,
            rarity: fullMod.rarity,
            compatName: fullMod.compatName,
            type: fullMod.type,
            levelStats: fullMod.levelStats,
            modSet: fullMod.modSet,
            modSetStats: fullMod.modSetStats,
          };
        }
      }
      return slot;
    };

    if (hydratedState.auraSlot) {
      hydratedState.auraSlot = hydrateSlot(hydratedState.auraSlot);
    }
    if (hydratedState.exilusSlot) {
      hydratedState.exilusSlot = hydrateSlot(hydratedState.exilusSlot);
    }
    hydratedState.normalSlots = hydratedState.normalSlots.map(hydrateSlot);

    return hydratedState;
  }

  return baseState;
}

// Local storage key for auto-save
const STORAGE_KEY_PREFIX = "arsenix_build_";

export function BuildContainer({
  item,
  category,
  categoryLabel,
  compatibleMods,
  importedBuild,
}: BuildContainerProps) {
  // Build state
  const [buildState, setBuildState] = useState<BuildState>(() =>
    createInitialBuildState(item, category, compatibleMods, importedBuild)
  );

  // Active slot for mod placement
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  // Copy notification
  const [showCopied, setShowCopied] = useState(false);

  // Guide state
  const [guideData, setGuideData] = useState<string | null>(null);

  // Drag and Drop State
  const [activeDragItem, setActiveDragItem] = useState<DragItem | null>(null);
  const lastOverRef = useRef<{ id: string; data: { type: string; slotId?: string } } | null>(null);

  // Router for navigation
  const router = useRouter();

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );

  // Stable ID for DndContext to prevent hydration mismatch
  const dndContextId = useId();

  // Place a mod in a specific slot
  const placeModInSlot = useCallback(
    (mod: Mod, rank: number, slotId: string) => {
      const placedMod: PlacedMod = {
        uniqueName: mod.uniqueName,
        name: mod.name,
        imageName: mod.imageName,
        polarity: mod.polarity,
        baseDrain: mod.baseDrain,
        fusionLimit: mod.fusionLimit,
        rank,
        rarity: mod.rarity,
        compatName: mod.compatName,
        type: mod.type,
        levelStats: mod.levelStats,
        modSet: mod.modSet,
        modSetStats: mod.modSetStats,
      };

      setBuildState((prev) => {
        const newState = { ...prev };

        // Remove existing instance of this mod if it exists to prevent duplicates
        if (newState.auraSlot?.mod?.uniqueName === mod.uniqueName) {
          newState.auraSlot = { ...newState.auraSlot, mod: undefined };
        }
        if (newState.exilusSlot?.mod?.uniqueName === mod.uniqueName) {
          newState.exilusSlot = { ...newState.exilusSlot, mod: undefined };
        }
        newState.normalSlots = newState.normalSlots.map((s) =>
          s.mod?.uniqueName === mod.uniqueName ? { ...s, mod: undefined } : s
        );

        // Place in new slot
        if (slotId.startsWith("aura") && newState.auraSlot) {
          newState.auraSlot = { ...newState.auraSlot, mod: placedMod };
        } else if (slotId.startsWith("exilus")) {
          newState.exilusSlot = { ...newState.exilusSlot, mod: placedMod };
        } else {
          const slotIndex = parseInt(slotId.replace("normal-", ""));
          if (!isNaN(slotIndex)) {
            newState.normalSlots = [...newState.normalSlots];
            newState.normalSlots[slotIndex] = {
              ...newState.normalSlots[slotIndex],
              mod: placedMod,
            };
          }
        }

        return newState;
      });
    },
    []
  );

  // Move mod from one slot to another (swap)
  const moveMod = useCallback((sourceSlotId: string, targetSlotId: string) => {
    setBuildState((prev) => {
      const newState = { ...prev };

      // Helper to get mod from slot ID
      const getMod = (id: string, state: BuildState) => {
        if (id.startsWith("aura")) return state.auraSlot?.mod;
        if (id.startsWith("exilus")) return state.exilusSlot.mod;
        const idx = parseInt(id.replace("normal-", ""));
        return state.normalSlots[idx]?.mod;
      };

      const sourceMod = getMod(sourceSlotId, newState);
      const targetMod = getMod(targetSlotId, newState);

      // Helper to set mod in slot
      const setModInSlot = (
        id: string,
        mod: PlacedMod | undefined,
        state: BuildState
      ) => {
        if (id.startsWith("aura") && state.auraSlot) {
          state.auraSlot = { ...state.auraSlot, mod };
        } else if (id.startsWith("exilus")) {
          state.exilusSlot = { ...state.exilusSlot, mod };
        } else {
          const idx = parseInt(id.replace("normal-", ""));
          if (!isNaN(idx)) {
            state.normalSlots = [...state.normalSlots];
            state.normalSlots[idx] = { ...state.normalSlots[idx], mod };
          }
        }
      };

      // Clone arrays/objects to avoid mutation
      if (newState.auraSlot) newState.auraSlot = { ...newState.auraSlot };
      newState.exilusSlot = { ...newState.exilusSlot };
      newState.normalSlots = [...newState.normalSlots];

      setModInSlot(sourceSlotId, targetMod, newState);
      setModInSlot(targetSlotId, sourceMod, newState);

      return newState;
    });
  }, []);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragItem(event.active.data.current as DragItem);
    lastOverRef.current = null;
    setActiveSlotId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    const overCurrent = over?.data?.current as { type?: string; slotId?: string } | undefined;
    if (overCurrent?.type === "slot") {
      lastOverRef.current = {
        id: String(over!.id),
        data: { type: overCurrent.type, slotId: overCurrent.slotId },
      };
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active } = event;
    const over = event.over ?? lastOverRef.current;
    setActiveDragItem(null);
    lastOverRef.current = null;

    if (!over) return;

    const activeData = active.data.current;
    // Extract overData - handle both DragOverEvent's over object and our cached lastOverRef
    const rawOverData = "data" in over && typeof over.data === "object" && over.data !== null && "current" in over.data
      ? (over.data as { current?: unknown }).current
      : (over as { data?: unknown }).data;
    const overData = rawOverData as { type?: string; slotId?: string; mod?: PlacedMod } | undefined;

    if (!activeData || !overData) return;

    // Case 1: Search Mod -> Slot
    if (activeData.type === "search-mod" && overData.type === "slot" && overData.slotId) {
      placeModInSlot(activeData.mod, activeData.rank, overData.slotId);
    }

    // Case 2: Placed Mod -> Slot (Swap/Move)
    if (activeData.type === "placed-mod" && overData.type === "slot" && overData.slotId) {
      const sourceSlotId = activeData.slotId;
      const targetSlotId = overData.slotId;

      if (sourceSlotId !== targetSlotId) {
        moveMod(sourceSlotId, targetSlotId);
      }
    }
  };

  const handleDragCancel = () => {
    setActiveDragItem(null);
    lastOverRef.current = null;
  };

  // Calculate capacity and endo cost
  const capacityStatus = getCapacityStatus(buildState);
  const totalEndoCost = calculateTotalEndoCost(buildState);
  const formaCount = calculateFormaCount(
    buildState.normalSlots,
    buildState.auraSlot,
    buildState.exilusSlot
  );

  // Auto-save to localStorage (debounced to avoid chatty writes while dragging)
  useEffect(() => {
    const key = `${STORAGE_KEY_PREFIX}${item.uniqueName}`;
    const handle = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(buildState));
      } catch {
        // Ignore storage errors
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [buildState, item.uniqueName]);

  // Load from localStorage on mount
  useEffect(() => {
    if (importedBuild) return; // Don't override imported builds

    const key = `${STORAGE_KEY_PREFIX}${item.uniqueName}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        setBuildState((prev) => ({
          ...prev,
          ...parsed,
          // Always use current item info
          itemUniqueName: item.uniqueName,
          itemName: item.name,
          itemCategory: category,
          itemImageName: item.imageName,
        }));
      }
    } catch {
      // Ignore parse errors
    }
  }, [item.uniqueName, item.name, item.imageName, category, importedBuild]);

  // Load guide data from localStorage on mount
  useEffect(() => {
    const guideKey = `arsenix_build_guide_${item.uniqueName}`;
    try {
      const savedGuide = localStorage.getItem(guideKey);
      if (savedGuide) {
        setGuideData(savedGuide);
      }
    } catch {
      // Ignore parse errors
    }
  }, [item.uniqueName]);

  // Toggle reactor/catalyst
  const handleToggleReactor = useCallback(() => {
    setBuildState((prev) => ({
      ...prev,
      hasReactor: !prev.hasReactor,
      baseCapacity: !prev.hasReactor ? 60 : 30,
    }));
  }, []);

  // Select a slot for mod placement
  const handleSelectSlot = useCallback((slotId: string) => {
    setActiveSlotId(slotId);
  }, []);

  // Place a mod in the active slot
  const handlePlaceMod = useCallback(
    (mod: Mod, rank: number = mod.fusionLimit) => {
      if (!activeSlotId) return;

      const placedMod: PlacedMod = {
        uniqueName: mod.uniqueName,
        name: mod.name,
        imageName: mod.imageName,
        polarity: mod.polarity,
        baseDrain: mod.baseDrain,
        fusionLimit: mod.fusionLimit,
        rank,
        rarity: mod.rarity,
        compatName: mod.compatName,
        type: mod.type,
        levelStats: mod.levelStats,
        modSet: mod.modSet,
        modSetStats: mod.modSetStats,
      };

      setBuildState((prev) => {
        const newState = { ...prev };

        // Find and update the slot
        if (activeSlotId.startsWith("aura") && newState.auraSlot) {
          newState.auraSlot = { ...newState.auraSlot, mod: placedMod };
        } else if (activeSlotId.startsWith("exilus")) {
          newState.exilusSlot = { ...newState.exilusSlot, mod: placedMod };
        } else {
          const slotIndex = parseInt(activeSlotId.replace("normal-", ""));
          if (!isNaN(slotIndex)) {
            newState.normalSlots = [...newState.normalSlots];
            newState.normalSlots[slotIndex] = {
              ...newState.normalSlots[slotIndex],
              mod: placedMod,
            };
          }
        }

        return newState;
      });

      // Auto-advance to next slot
      const currentIndex = parseInt(activeSlotId.replace("normal-", ""));
      if (!isNaN(currentIndex) && currentIndex < 7) {
        setActiveSlotId(`normal-${currentIndex + 1}`);
      } else {
        setActiveSlotId(null);
      }
    },
    [activeSlotId]
  );

  // Remove a mod from a slot
  const handleRemoveMod = useCallback((slotId: string) => {
    setBuildState((prev) => {
      const newState = { ...prev };

      if (slotId.startsWith("aura") && newState.auraSlot) {
        newState.auraSlot = { ...newState.auraSlot, mod: undefined };
      } else if (slotId.startsWith("exilus")) {
        newState.exilusSlot = { ...newState.exilusSlot, mod: undefined };
      } else {
        const slotIndex = parseInt(slotId.replace("normal-", ""));
        if (!isNaN(slotIndex)) {
          newState.normalSlots = [...newState.normalSlots];
          newState.normalSlots[slotIndex] = {
            ...newState.normalSlots[slotIndex],
            mod: undefined,
          };
        }
      }

      return newState;
    });
  }, []);

  // Change rank of a mod in a slot
  const handleChangeRank = useCallback((slotId: string, newRank: number) => {
    setBuildState((prev) => {
      const newState = { ...prev };

      const updateModRank = (slot: ModSlot | undefined) => {
        if (!slot?.mod) return slot;
        const clampedRank = Math.max(0, Math.min(newRank, slot.mod.fusionLimit));
        return {
          ...slot,
          mod: { ...slot.mod, rank: clampedRank },
        };
      };

      if (slotId.startsWith("aura") && newState.auraSlot) {
        newState.auraSlot = updateModRank(newState.auraSlot);
      } else if (slotId.startsWith("exilus")) {
        newState.exilusSlot = updateModRank(newState.exilusSlot)!;
      } else {
        const slotIndex = parseInt(slotId.replace("normal-", ""));
        if (!isNaN(slotIndex)) {
          newState.normalSlots = [...newState.normalSlots];
          newState.normalSlots[slotIndex] = updateModRank(
            newState.normalSlots[slotIndex]
          )!;
        }
      }

      return newState;
    });
  }, []);

  // Apply forma to a slot (or clear to blank with "universal")
  const handleApplyForma = useCallback((slotId: string, polarity: Polarity) => {
    setBuildState((prev) => {
      const newState = { ...prev };

      if (slotId.startsWith("aura") && newState.auraSlot) {
        newState.auraSlot = { ...newState.auraSlot, formaPolarity: polarity };
      } else if (slotId.startsWith("exilus")) {
        newState.exilusSlot = {
          ...newState.exilusSlot,
          formaPolarity: polarity,
        };
      } else {
        const slotIndex = parseInt(slotId.replace("normal-", ""));
        if (!isNaN(slotIndex)) {
          newState.normalSlots = [...newState.normalSlots];
          newState.normalSlots[slotIndex] = {
            ...newState.normalSlots[slotIndex],
            formaPolarity: polarity,
          };
        }
      }

      return newState;
    });
  }, []);

  // Copy build to clipboard
  const handleCopyBuild = useCallback(async () => {
    const success = await copyBuildToClipboard(buildState);
    if (success) {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  }, [buildState]);

  // Clear build
  const handleClearBuild = useCallback(() => {
    setBuildState(createInitialBuildState(item, category, compatibleMods));
    setActiveSlotId(null);
  }, [item, category, compatibleMods]);

  // Save build (placeholder for future POST)
  const handleSaveBuild = useCallback(async () => {
    // TODO: Implement POST to save build to backend
    // For now, just copy to clipboard as a placeholder
    const success = await copyBuildToClipboard(buildState);
    if (success) {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  }, [buildState]);

  // Cancel and go back (clears localStorage)
  const handleCancel = useCallback(() => {
    // Clear build from localStorage
    const buildKey = `${STORAGE_KEY_PREFIX}${item.uniqueName}`;
    const guideKey = `arsenix_build_guide_${item.uniqueName}`;
    try {
      localStorage.removeItem(buildKey);
      localStorage.removeItem(guideKey);
    } catch {
      // Ignore storage errors
    }
    // Navigate back
    router.back();
  }, [item.uniqueName, router]);

  // Get all used mod names for duplicate checking
  const usedModNames = useMemo((): string[] => {
    const names: string[] = [];

    if (buildState.auraSlot?.mod) names.push(buildState.auraSlot.mod.name);
    if (buildState.exilusSlot?.mod) names.push(buildState.exilusSlot.mod.name);

    for (const slot of buildState.normalSlots) {
      if (slot.mod) names.push(slot.mod.name);
    }

    return names;
  }, [buildState]);

  // Keyboard navigation
  const isWarframeOrNecramech =
    category === "warframes" || category === "necramechs";

  useBuildKeyboard({
    onSelectSlot: handleSelectSlot,
    onOpenSearch: () => { },
    onCloseSearch: () => {
      setActiveSlotId(null);
    },
    onCopyBuild: handleCopyBuild,
    onClearBuild: handleClearBuild,
    hasAuraSlot: isWarframeOrNecramech,
  });

  return (
    <DndContext
      id={dndContextId}
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="container py-6">
        {/* Header Card */}
        <div className="bg-card border rounded-lg p-4 mb-4">
          <div className="flex gap-4 items-center justify-between">
            <div className="flex gap-4 items-center">
              <div className="relative w-24 h-24 bg-muted/10 rounded-md flex items-center justify-center overflow-hidden">
                <Image
                  src={getImageUrl(item.imageName)}
                  alt={item.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col justify-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight">{item.name}</h1>
                <span className="text-sm text-muted-foreground">
                  {categoryLabel}
                </span>
                <div className="flex items-center gap-3">
                  {/* Capacity indicator */}

                  {/* Endo cost indicator */}
                  <Badge
                    variant="secondary"
                    className="gap-1.5 px-2 py-0.5 font-semibold text-xs bg-muted/50 hover:bg-muted"
                  >
                    <Diamond className="w-3 h-3 fill-current" />
                    {totalEndoCost.toLocaleString()}
                  </Badge>
                  {/* Forma count indicator */}
                  {formaCount > 0 && (
                    <Badge
                      variant="secondary"
                      className="gap-1.5 px-2 py-0.5 font-semibold text-xs bg-muted/50 hover:bg-muted"
                    >
                      <Gem className="w-3 h-3" />
                      {formaCount}
                    </Badge>
                  )}
                </div>
              </div>
            </div>
            {/* Build Actions - Top Right */}
            <div className="self-start flex items-center gap-2">
              <GuideEditorDialog
                buildId={item.uniqueName}
                initialGuide={guideData}
                onSaved={(payload) => setGuideData(payload.guide)}
              />
              <Button
                variant="default"
                size="sm"
                className="gap-2"
                onClick={handleSaveBuild}
              >
                <Save className="w-4 h-4" />
                {showCopied ? "Saved!" : "Save"}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={handleCancel}
              >
                <X className="w-4 h-4" />
                Cancel
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content: Sidebar + Vertical Stack */}
        <div className="flex gap-4 items-start">
          {/* Left Sidebar (Stats) */}
          <div className="w-[260px] shrink-0 bg-card border rounded-lg">
            <ItemSidebar
              buildState={buildState}
              capacityStatus={capacityStatus}
              onToggleReactor={handleToggleReactor}
              onCopyBuild={handleCopyBuild}
              onClearBuild={handleClearBuild}
              showCopied={showCopied}
              itemStats={extractItemStats(item)}
            />
          </div>

          {/* Main Content: Vertical Stack */}
          <div className="flex-1 flex flex-col gap-4 min-w-0">
            {/* Mod Slots Grid */}
            <div className="bg-card border rounded-lg p-4">
              <ModGrid
                auraSlot={buildState.auraSlot}
                exilusSlot={buildState.exilusSlot}
                normalSlots={buildState.normalSlots}
                activeSlotId={activeSlotId}
                onSelectSlot={handleSelectSlot}
                onRemoveMod={handleRemoveMod}
                onChangeRank={handleChangeRank}
                onApplyForma={handleApplyForma}
                isWarframe={isWarframeOrNecramech}
              />
            </div>

            {/* Mod Search Grid */}
            <div className="bg-card border rounded-lg p-4">
              <ModSearchGrid
                availableMods={compatibleMods}
                slotType={getSlotType(activeSlotId)}
                usedModNames={usedModNames}
                onSelectMod={handlePlaceMod}
              />
            </div>
          </div>
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDragItem ? (
          <div className="opacity-90 cursor-grabbing shadow-xl rounded-lg">
            <CompactModCard
              mod={activeDragItem.mod as Mod}
              rarity={(activeDragItem.mod.rarity || "Common") as ModRarity}
              rank={
                activeDragItem.rank ??
                ("rank" in activeDragItem.mod ? activeDragItem.mod.rank : 0)
              }
              isMaxRank={
                (activeDragItem.rank ??
                  ("rank" in activeDragItem.mod ? activeDragItem.mod.rank : 0)) >=
                (activeDragItem.mod.fusionLimit ?? 0)
              }
              disableAnimation
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

// Helper to determine slot type from slot ID
function getSlotType(
  slotId: string | null
): "aura" | "exilus" | "normal" | "arcane" {
  if (!slotId) return "normal";
  if (slotId.startsWith("aura")) return "aura";
  if (slotId.startsWith("exilus")) return "exilus";
  if (slotId.startsWith("arcane")) return "arcane";
  return "normal";
}
