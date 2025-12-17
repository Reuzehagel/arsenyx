"use client";

import { useState, useCallback, useEffect, useMemo, useRef, useId } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
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
import { ArcaneSearchPanel } from "./arcane-search-panel";
import { CompactModCard, type ModRarity } from "@/components/mod-card";
import { ArcaneDragGhost } from "@/components/arcane-card";
import { useBuildKeyboard } from "./use-build-keyboard";
import {
  getCapacityStatus,
  calculateTotalEndoCost,
  calculateFormaCount,
} from "@/lib/warframe/capacity";
import { normalizePolarity } from "@/lib/warframe/mods";
import { copyBuildToClipboard } from "@/lib/build-codec";
import { saveBuildAction } from "@/app/actions/builds";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getImageUrl } from "@/lib/warframe/images";
import type {
  BuildState,
  ModSlot,
  PlacedMod,
  PlacedArcane,
  Polarity,
  BrowseCategory,
  BrowseableItem,
  Mod,
  Arcane,
} from "@/lib/warframe/types";
import { Diamond, Gem, Save, X, Loader2, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

type DragItem =
  | { type: "search-mod"; mod: Mod; rank: number }
  | { type: "placed-mod"; mod: PlacedMod; slotId: string; rank?: number }
  | { type: "search-arcane"; arcane: Arcane; rank: number }
  | { type: "placed-arcane"; arcane: PlacedArcane; slotIndex: number };

interface BuildContainerProps {
  item: BrowseableItem;
  category: BrowseCategory;
  categoryLabel: string;
  compatibleMods: Mod[];
  compatibleArcanes?: Arcane[];
  importedBuild?: Partial<BuildState>;
  savedBuildId?: string; // If editing an existing database build
  savedBuildSlug?: string;
  readOnly?: boolean; // View-only mode for non-owners
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
            isExilus: fullMod.isExilus,
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
  compatibleArcanes = [],
  importedBuild,
  savedBuildId,
  savedBuildSlug,
  readOnly = false,
}: BuildContainerProps) {
  // Auth session
  const { data: session, status: sessionStatus } = useSession();
  const isAuthenticated = sessionStatus === "authenticated" && !!session?.user;

  // In read-only mode, disable all editing
  const canEdit = !readOnly;

  // Build state
  const [buildState, setBuildState] = useState<BuildState>(() =>
    createInitialBuildState(item, category, compatibleMods, importedBuild)
  );

  // Build metadata for database persistence
  const [buildId, setBuildId] = useState<string | undefined>(savedBuildId);
  const [buildSlug, setBuildSlug] = useState<string | undefined>(savedBuildSlug);
  const [buildName, setBuildName] = useState<string>(
    importedBuild?.buildName || `${item.name} Build`
  );

  // Save status: 'idle' | 'saving' | 'saved' | 'error'
  type SaveStatus = "idle" | "saving" | "saved" | "error";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Active slot for mod placement
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  // Copy notification
  const [showCopied, setShowCopied] = useState(false);

  // Guide state
  const [guideData, setGuideData] = useState<string | null>(null);

  // Drag and Drop State
  const [activeDragItem, setActiveDragItem] = useState<DragItem | null>(null);
  const lastOverRef = useRef<{ id: string; data: { type: string; slotId?: string; slotIndex?: number } } | null>(null);

  // Router for navigation
  const router = useRouter();

  // Sensors for drag-and-drop (disabled in read-only mode)
  const editSensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 3,
      },
    })
  );
  const noSensors = useSensors(); // Empty sensors for read-only mode
  const sensors = canEdit ? editSensors : noSensors;

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
        isExilus: mod.isExilus,
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

  // ==========================================================================
  // ARCANE HANDLERS
  // ==========================================================================

  // Place an arcane in a specific slot
  const placeArcaneInSlot = useCallback(
    (arcane: Arcane, rank: number, slotIndex: number) => {
      const placedArcane: PlacedArcane = {
        uniqueName: arcane.uniqueName,
        name: arcane.name,
        imageName: arcane.imageName,
        rank,
        rarity: arcane.rarity,
      };

      setBuildState((prev) => {
        const newArcaneSlots = [...(prev.arcaneSlots || [])];

        // Remove existing instance of this arcane if it exists
        const existingIndex = newArcaneSlots.findIndex(
          (a) => a?.uniqueName === arcane.uniqueName
        );
        if (existingIndex !== -1 && existingIndex !== slotIndex) {
          newArcaneSlots[existingIndex] = undefined as unknown as PlacedArcane;
        }

        // Place in new slot
        newArcaneSlots[slotIndex] = placedArcane;

        return { ...prev, arcaneSlots: newArcaneSlots };
      });
    },
    []
  );

  // Move arcane between slots (swap)
  const moveArcane = useCallback((sourceIndex: number, targetIndex: number) => {
    setBuildState((prev) => {
      const newArcaneSlots = [...(prev.arcaneSlots || [])];
      const sourceArcane = newArcaneSlots[sourceIndex];
      const targetArcane = newArcaneSlots[targetIndex];

      newArcaneSlots[sourceIndex] = targetArcane;
      newArcaneSlots[targetIndex] = sourceArcane;

      return { ...prev, arcaneSlots: newArcaneSlots };
    });
  }, []);

  // Remove arcane from a slot
  const handleRemoveArcane = useCallback((slotIndex: number) => {
    setBuildState((prev) => {
      const newArcaneSlots = [...(prev.arcaneSlots || [])];
      newArcaneSlots[slotIndex] = undefined as unknown as PlacedArcane;
      return { ...prev, arcaneSlots: newArcaneSlots };
    });
  }, []);

  // Change rank of an arcane in a slot
  const handleChangeArcaneRank = useCallback(
    (slotIndex: number, newRank: number) => {
      setBuildState((prev) => {
        const newArcaneSlots = [...(prev.arcaneSlots || [])];
        const arcane = newArcaneSlots[slotIndex];
        if (arcane) {
          // Max rank for arcanes is typically 5 (index 0-5 in levelStats)
          const maxRank = 5;
          const clampedRank = Math.max(0, Math.min(newRank, maxRank));
          newArcaneSlots[slotIndex] = { ...arcane, rank: clampedRank };
        }
        return { ...prev, arcaneSlots: newArcaneSlots };
      });
    },
    []
  );

  // Place arcane in active slot (for click-to-place)
  const handlePlaceArcane = useCallback(
    (arcane: Arcane, rank: number) => {
      if (!activeSlotId || !activeSlotId.startsWith("arcane-")) return;

      const slotIndex = parseInt(activeSlotId.replace("arcane-", ""));
      if (isNaN(slotIndex)) return;

      placeArcaneInSlot(arcane, rank, slotIndex);

      // Auto-advance to next arcane slot or clear
      if (slotIndex === 0) {
        setActiveSlotId("arcane-1");
      } else {
        setActiveSlotId(null);
      }
    },
    [activeSlotId, placeArcaneInSlot]
  );

  // Get all used arcane names for duplicate checking
  const usedArcaneNames = useMemo((): string[] => {
    return (buildState.arcaneSlots || [])
      .filter(Boolean)
      .map((a) => a.name);
  }, [buildState.arcaneSlots]);

  // Create a map of arcane uniqueName -> full Arcane data for hydration
  const arcaneDataMap = useMemo(() => {
    const map = new Map<string, Arcane>();
    for (const arcane of compatibleArcanes) {
      map.set(arcane.uniqueName, arcane);
    }
    return map;
  }, [compatibleArcanes]);

  // ==========================================================================
  // DRAG HANDLERS
  // ==========================================================================

  const handleDragStart = (event: DragStartEvent) => {
    setActiveDragItem(event.active.data.current as DragItem);
    lastOverRef.current = null;
    setActiveSlotId(null);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    const overCurrent = over?.data?.current as { type?: string; slotId?: string; slotIndex?: number } | undefined;
    if (overCurrent?.type === "slot" || overCurrent?.type === "arcane-slot") {
      lastOverRef.current = {
        id: String(over!.id),
        data: { type: overCurrent.type, slotId: overCurrent.slotId, slotIndex: overCurrent.slotIndex },
      };
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active } = event;
    const over = event.over ?? lastOverRef.current;
    setActiveDragItem(null);
    lastOverRef.current = null;

    if (!over) return;

    const activeData = active.data.current as DragItem | undefined;
    // Extract overData - handle both DragOverEvent's over object and our cached lastOverRef
    const rawOverData = "data" in over && typeof over.data === "object" && over.data !== null && "current" in over.data
      ? (over.data as { current?: unknown }).current
      : (over as { data?: unknown }).data;
    const overData = rawOverData as { type?: string; slotId?: string; slotIndex?: number; mod?: PlacedMod } | undefined;

    if (!activeData || !overData) return;

    // ==========================================================================
    // MOD DRAG HANDLING
    // ==========================================================================

    // Validate mod slot restrictions
    if (overData.type === "slot" && overData.slotId && (activeData.type === "search-mod" || activeData.type === "placed-mod")) {
      // Find full mod data to ensure we have correct flags (isExilus etc) in case placed mod state is stale
      const mod = activeData.mod;
      const fullMod = compatibleMods.find((m) => m.uniqueName === mod.uniqueName) || mod;

      // Aura slot restriction
      if (overData.slotId.startsWith("aura")) {
        const isAura =
          fullMod.type?.toLowerCase().includes("aura") ||
          fullMod.compatName?.toLowerCase() === "aura";
        if (!isAura) return;
      }

      // Exilus slot restriction
      if (overData.slotId.startsWith("exilus")) {
        // Exilus slots can only accept Exilus mods
        if (!fullMod.isExilus) return;
      }
    }

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

    // ==========================================================================
    // ARCANE DRAG HANDLING
    // ==========================================================================

    // Case 3: Search Arcane -> Arcane Slot
    if (activeData.type === "search-arcane" && overData.type === "arcane-slot" && overData.slotIndex !== undefined) {
      placeArcaneInSlot(activeData.arcane, activeData.rank, overData.slotIndex);
    }

    // Case 4: Placed Arcane -> Arcane Slot (Swap/Move)
    if (activeData.type === "placed-arcane" && overData.type === "arcane-slot" && overData.slotIndex !== undefined) {
      const sourceIndex = activeData.slotIndex;
      const targetIndex = overData.slotIndex;

      if (sourceIndex !== targetIndex) {
        moveArcane(sourceIndex, targetIndex);
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
  // Skip in read-only mode
  useEffect(() => {
    if (!canEdit) return; // Don't save in read-only mode

    const key = `${STORAGE_KEY_PREFIX}${item.uniqueName}`;
    const handle = window.setTimeout(() => {
      try {
        localStorage.setItem(key, JSON.stringify(buildState));
      } catch {
        // Ignore storage errors
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [buildState, item.uniqueName, canEdit]);

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

  // Handle Helminth ability selection
  const handleHelminthAbilityChange = useCallback((slotIndex: number, ability: any | null) => {
    setBuildState((prev) => ({
      ...prev,
      helminthAbility: ability
        ? {
          slotIndex,
          ability,
        }
        : undefined,
    }));
  }, []);

  // Save build (authenticated: DB, guest: clipboard fallback)
  const handleSaveBuild = useCallback(async () => {
    // For authenticated users, save to database
    if (isAuthenticated) {
      setSaveStatus("saving");
      setSaveError(null);

      try {
        const result = await saveBuildAction({
          buildId: buildId,
          itemUniqueName: item.uniqueName,
          name: buildName,
          visibility: "PUBLIC", // TODO: Add visibility selector
          buildData: { ...buildState, buildName },
          guide: guideData || undefined,
        });

        if (result.success && result.build) {
          setBuildId(result.build.id);
          setBuildSlug(result.build.slug);
          setSaveStatus("saved");
          setTimeout(() => setSaveStatus("idle"), 2000);
        } else {
          setSaveStatus("error");
          setSaveError(result.error || "Failed to save build");
          setTimeout(() => setSaveStatus("idle"), 3000);
        }
      } catch (error) {
        console.error("Save build error:", error);
        setSaveStatus("error");
        setSaveError("An unexpected error occurred");
        setTimeout(() => setSaveStatus("idle"), 3000);
      }
      return;
    }

    // For guests, copy to clipboard as fallback
    const success = await copyBuildToClipboard(buildState);
    if (success) {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  }, [isAuthenticated, buildId, item.uniqueName, buildName, buildState]);

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
            {/* Build Actions - Top Right (only show when editing is allowed) */}
            {canEdit && (
              <div className="self-start flex items-center gap-2">
                {/* Build Name Input (for authenticated users) */}
                {isAuthenticated && (
                  <Input
                    value={buildName}
                    onChange={(e) => setBuildName(e.target.value)}
                    placeholder="Build name..."
                    className="w-48 h-8 text-sm"
                  />
                )}
                <GuideEditorDialog
                  buildId={item.uniqueName}
                  initialGuide={guideData}
                  onSaved={(payload) => setGuideData(payload.guide)}
                />
                {isAuthenticated ? (
                  <Button
                    variant="default"
                    size="sm"
                    className="gap-2"
                    onClick={handleSaveBuild}
                    disabled={saveStatus === "saving"}
                  >
                    {saveStatus === "saving" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    {saveStatus === "saving"
                      ? "Saving..."
                      : saveStatus === "saved"
                        ? "Saved!"
                        : saveStatus === "error"
                          ? "Error"
                          : buildId
                            ? "Update"
                            : "Save"}
                  </Button>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleCopyBuild}
                  >
                    <Save className="w-4 h-4" />
                    {showCopied ? "Copied!" : "Copy Link"}
                  </Button>
                )}
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
            )}
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
              readOnly={!canEdit}
              onHelminthAbilityChange={handleHelminthAbilityChange}
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
                activeSlotId={canEdit ? activeSlotId : null}
                onSelectSlot={canEdit ? handleSelectSlot : () => { }}
                onRemoveMod={canEdit ? handleRemoveMod : () => { }}
                onChangeRank={canEdit ? handleChangeRank : () => { }}
                onApplyForma={canEdit ? handleApplyForma : () => { }}
                isWarframe={isWarframeOrNecramech}
                draggedMod={canEdit && (activeDragItem?.type === "search-mod" || activeDragItem?.type === "placed-mod") ? activeDragItem.mod : undefined}
                arcaneSlots={buildState.arcaneSlots}
                onRemoveArcane={canEdit ? handleRemoveArcane : () => { }}
                onChangeArcaneRank={canEdit ? handleChangeArcaneRank : () => { }}
                draggedArcane={canEdit && (activeDragItem?.type === "search-arcane" ? activeDragItem.arcane : activeDragItem?.type === "placed-arcane" ? activeDragItem.arcane : undefined) || undefined}
                arcaneDataMap={arcaneDataMap}
                readOnly={!canEdit}
              />
            </div>

            {/* Mod/Arcane Search Grid - only show when editing */}
            {canEdit && (
              <div className="bg-card border rounded-lg p-4">
                {getSlotType(activeSlotId) === "arcane" && isWarframeOrNecramech && compatibleArcanes.length > 0 ? (
                  <ArcaneSearchPanel
                    availableArcanes={compatibleArcanes}
                    usedArcaneNames={usedArcaneNames}
                    onSelectArcane={handlePlaceArcane}
                  />
                ) : (
                  <ModSearchGrid
                    availableMods={compatibleMods}
                    slotType={getSlotType(activeSlotId)}
                    usedModNames={usedModNames}
                    onSelectMod={handlePlaceMod}
                  />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDragItem && (activeDragItem.type === "search-mod" || activeDragItem.type === "placed-mod") ? (
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
        ) : activeDragItem && activeDragItem.type === "search-arcane" ? (
          <div className="opacity-90 cursor-grabbing shadow-xl rounded-lg">
            <ArcaneDragGhost arcane={activeDragItem.arcane} />
          </div>
        ) : activeDragItem && activeDragItem.type === "placed-arcane" ? (
          <div className="opacity-90 cursor-grabbing shadow-xl rounded-lg">
            <ArcaneDragGhost arcane={activeDragItem.arcane} />
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
