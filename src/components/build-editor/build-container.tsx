"use client";

import {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useId,
} from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useSession } from "@/lib/auth-client";
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
import { ModGrid } from "./mod-grid";
import { ModSearchGrid } from "./mod-search-grid";
import { ArcaneSearchPanel } from "./arcane-search-panel";
import { InlineGuideEditor } from "./inline-guide-editor";
import { PartnerBuildSelector } from "./partner-build-selector";
import type { PartnerBuild } from "./partner-build-card";
import { PartnerBuildsSection } from "@/components/build/partner-builds-section";
import { GuideReader } from "@/components/guides/guide-reader";
import { CompactModCard, type ModRarity } from "@/components/mod-card";
import { ArcaneDragGhost } from "@/components/arcane-card";
import { useBuildKeyboard } from "./use-build-keyboard";
import {
  getCapacityStatus,
  calculateTotalEndoCost,
  calculateFormaCount,
} from "@/lib/warframe/capacity";
import { normalizePolarity } from "@/lib/warframe/mods";
import { getModBaseName } from "@/lib/warframe/mod-variants";
import { copyBuildToClipboard } from "@/lib/build-codec";
import {
  saveBuildAction,
  getUserBuildsForPartnerSelectorAction,
} from "@/app/actions/builds";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { getImageUrl } from "@/lib/warframe/images";
import type {
  BuildState,
  ModSlot,
  PlacedMod,
  PlacedArcane,
  PlacedShard,
  Polarity,
  BrowseCategory,
  BrowseableItem,
  Mod,
  Arcane,
  HelminthAbility,
} from "@/lib/warframe/types";
import {
  Diamond,
  Gem,
  Save,
  X,
  Loader2,
  UploadCloud,
  Pencil,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PublishDialog, type Visibility } from "./publish-dialog";

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
  isOwner?: boolean; // Whether the current user owns this build
  // Guide data for existing builds
  initialGuide?: {
    summary?: string | null;
    description?: string | null;
    updatedAt?: Date;
  };
  initialPartnerBuilds?: {
    id: string;
    slug: string;
    name: string;
    item: {
      name: string;
      imageName: string | null;
      browseCategory: string;
    };
    buildData: { formaCount: number };
  }[];
}

// Extract stats from item data (warframes and weapons)
interface ItemStats {
  // Warframe stats
  health?: number;
  shield?: number;
  armor?: number;
  energy?: number;
  sprintSpeed?: number;
  abilities?: Array<{ name: string; imageName?: string; description: string }>;
  // Weapon stats (all)
  fireRate?: number;
  criticalChance?: number;
  criticalMultiplier?: number;
  procChance?: number; // status chance
  totalDamage?: number;
  // Gun stats (primary/secondary)
  magazineSize?: number;
  reloadTime?: number;
  // Melee stats
  range?: number;
  comboDuration?: number;
}

function extractItemStats(item: BrowseableItem): ItemStats {
  const data = item as {
    // Warframe
    health?: number;
    shield?: number;
    armor?: number;
    power?: number;
    sprintSpeed?: number;
    abilities?: Array<{
      name: string;
      imageName?: string;
      description: string;
    }>;
    // Weapon
    fireRate?: number;
    criticalChance?: number;
    criticalMultiplier?: number;
    procChance?: number;
    totalDamage?: number;
    magazineSize?: number;
    reloadTime?: number;
    range?: number;
    comboDuration?: number;
  };
  return {
    // Warframe stats
    health: data.health,
    shield: data.shield,
    armor: data.armor,
    energy: data.power,
    sprintSpeed: data.sprintSpeed,
    abilities: data.abilities,
    // Weapon stats
    fireRate: data.fireRate,
    criticalChance: data.criticalChance,
    criticalMultiplier: data.criticalMultiplier,
    procChance: data.procChance,
    totalDamage: data.totalDamage,
    magazineSize: data.magazineSize,
    reloadTime: data.reloadTime,
    range: data.range,
    comboDuration: data.comboDuration,
  };
}

// Create initial mod slots with optional innate polarities
function createInitialSlots(polarities?: string[]): ModSlot[] {
  return Array.from({ length: 8 }, (_, i) => ({
    id: `normal-${i}`,
    type: "normal" as const,
    innatePolarity: polarities?.[i]
      ? normalizePolarity(polarities[i])
      : undefined,
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
    shardSlots: [], // Will be initialized below for warframes
    baseCapacity: 60,
    currentCapacity: 60,
    formaCount: 0,
  };

  // Add aura slot for warframes with innate aura polarity
  if (isWarframe) {
    baseState.auraSlot = {
      id: "aura-0",
      type: "aura",
      innatePolarity: auraPolarity
        ? normalizePolarity(auraPolarity)
        : undefined,
    };
    baseState.arcaneSlots = [
      undefined as unknown as PlacedArcane,
      undefined as unknown as PlacedArcane,
    ];
    // Only actual warframes (not necramechs) have shard slots
    if (category === "warframes") {
      baseState.shardSlots = [null, null, null, null, null];
    }
  } else if (["primary", "secondary", "melee"].includes(category)) {
    // Weapons have 1 arcane slot
    baseState.arcaneSlots = [undefined as unknown as PlacedArcane];
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
const GUIDE_STORAGE_KEY_PREFIX = "arsenix_build_guide_";

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
  isOwner = false,
  initialGuide,
  initialPartnerBuilds = [],
}: BuildContainerProps) {
  // Auth session
  const { data: session, isPending: isSessionPending } = useSession();
  const isAuthenticated = !isSessionPending && !!session?.user;

  // Track edit mode for owners (initially false = view mode)
  const [isEditMode, setIsEditMode] = useState(false);

  // canEdit: owners can edit when in edit mode, non-owners never
  // For new builds (no savedBuildId), always allow editing
  const canEdit = savedBuildId ? isOwner && isEditMode : !readOnly;

  // Build state
  const [buildState, setBuildState] = useState<BuildState>(() =>
    createInitialBuildState(item, category, compatibleMods, importedBuild)
  );

  // Build metadata for database persistence
  const [buildId, setBuildId] = useState<string | undefined>(savedBuildId);
  const [, setBuildSlug] = useState<string | undefined>(savedBuildSlug);
  const [buildName, setBuildName] = useState<string>(
    importedBuild?.buildName || `${item.name} Build`
  );

  // Save status: 'idle' | 'saving' | 'saved' | 'error'
  type SaveStatus = "idle" | "saving" | "saved" | "error";
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle");

  // Guide state (for inline editor)
  const [guideSummary, setGuideSummary] = useState<string>(
    initialGuide?.summary ?? ""
  );
  const [guideDescription, setGuideDescription] = useState<string>(
    initialGuide?.description ?? ""
  );

  // Partner builds state
  const [partnerBuilds, setPartnerBuilds] = useState(initialPartnerBuilds);
  const [availableBuilds, setAvailableBuilds] = useState<
    {
      id: string;
      slug: string;
      name: string;
      item: { name: string; imageName: string | null; browseCategory: string };
      buildData: { formaCount: number };
    }[]
  >([]);

  const [, setSaveError] = useState<string | null>(null);
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);

  // Active slot for mod placement
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  // Copy notification
  const [showCopied, setShowCopied] = useState(false);

  // Drag and Drop State
  const [activeDragItem, setActiveDragItem] = useState<DragItem | null>(null);
  const lastOverRef = useRef<{
    id: string;
    data: { type: string; slotId?: string; slotIndex?: number };
  } | null>(null);

  // Router for navigation
  const router = useRouter();

  // Sensors for drag-and-drop
  // Always use the same sensor to avoid React hook array size changes
  // Use a huge distance constraint when read-only to effectively disable dragging
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: canEdit ? 3 : 999999,
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
        isExilus: mod.isExilus,
      };

      setBuildState((prev) => {
        const newState = { ...prev };
        const baseName = getModBaseName(mod.name);

        // Remove existing instance of this mod or its variants to prevent duplicates
        if (
          newState.auraSlot?.mod &&
          getModBaseName(newState.auraSlot.mod.name) === baseName
        ) {
          newState.auraSlot = { ...newState.auraSlot, mod: undefined };
        }
        if (
          newState.exilusSlot?.mod &&
          getModBaseName(newState.exilusSlot.mod.name) === baseName
        ) {
          newState.exilusSlot = { ...newState.exilusSlot, mod: undefined };
        }
        newState.normalSlots = newState.normalSlots.map((s) =>
          s.mod && getModBaseName(s.mod.name) === baseName
            ? { ...s, mod: undefined }
            : s
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
    return (buildState.arcaneSlots || []).filter(Boolean).map((a) => a.name);
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
  // SHARD HANDLERS
  // ==========================================================================

  // Place a shard in a specific slot
  const handlePlaceShard = useCallback(
    (slotIndex: number, shard: PlacedShard) => {
      setBuildState((prev) => {
        const newShardSlots = [
          ...(prev.shardSlots || [null, null, null, null, null]),
        ];
        newShardSlots[slotIndex] = shard;
        return { ...prev, shardSlots: newShardSlots };
      });
    },
    []
  );

  // Remove a shard from a slot
  const handleRemoveShard = useCallback((slotIndex: number) => {
    setBuildState((prev) => {
      const newShardSlots = [
        ...(prev.shardSlots || [null, null, null, null, null]),
      ];
      newShardSlots[slotIndex] = null;
      return { ...prev, shardSlots: newShardSlots };
    });
  }, []);

  // ==========================================================================
  // DRAG HANDLERS
  // ==========================================================================

  const handleDragStart = (event: DragStartEvent) => {
    const dragData = event.active.data.current as DragItem;
    setActiveDragItem(dragData);
    lastOverRef.current = null;
    // Don't clear activeSlotId when dragging arcanes - keep the panel visible
    if (
      dragData?.type !== "search-arcane" &&
      dragData?.type !== "placed-arcane"
    ) {
      setActiveSlotId(null);
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    const overCurrent = over?.data?.current as
      | { type?: string; slotId?: string; slotIndex?: number }
      | undefined;
    if (overCurrent?.type === "slot" || overCurrent?.type === "arcane-slot") {
      lastOverRef.current = {
        id: String(over!.id),
        data: {
          type: overCurrent.type,
          slotId: overCurrent.slotId,
          slotIndex: overCurrent.slotIndex,
        },
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
    const rawOverData =
      "data" in over &&
      typeof over.data === "object" &&
      over.data !== null &&
      "current" in over.data
        ? (over.data as { current?: unknown }).current
        : (over as { data?: unknown }).data;
    const overData = rawOverData as
      | { type?: string; slotId?: string; slotIndex?: number; mod?: PlacedMod }
      | undefined;

    if (!activeData || !overData) return;

    // ==========================================================================
    // MOD DRAG HANDLING
    // ==========================================================================

    // Validate mod slot restrictions
    if (
      overData.type === "slot" &&
      overData.slotId &&
      (activeData.type === "search-mod" || activeData.type === "placed-mod")
    ) {
      // Find full mod data to ensure we have correct flags (isExilus etc) in case placed mod state is stale
      const mod = activeData.mod;
      const fullMod =
        compatibleMods.find((m) => m.uniqueName === mod.uniqueName) || mod;

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
    if (
      activeData.type === "search-mod" &&
      overData.type === "slot" &&
      overData.slotId
    ) {
      placeModInSlot(activeData.mod, activeData.rank, overData.slotId);
    }

    // Case 2: Placed Mod -> Slot (Swap/Move)
    if (
      activeData.type === "placed-mod" &&
      overData.type === "slot" &&
      overData.slotId
    ) {
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
    if (
      activeData.type === "search-arcane" &&
      overData.type === "arcane-slot" &&
      overData.slotIndex !== undefined
    ) {
      placeArcaneInSlot(activeData.arcane, activeData.rank, overData.slotIndex);
    }

    // Case 4: Placed Arcane -> Arcane Slot (Swap/Move)
    if (
      activeData.type === "placed-arcane" &&
      overData.type === "arcane-slot" &&
      overData.slotIndex !== undefined
    ) {
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

  // Auto-save guide to localStorage
  useEffect(() => {
    if (!canEdit) return;

    const key = `${GUIDE_STORAGE_KEY_PREFIX}${item.uniqueName}`;
    const handle = window.setTimeout(() => {
      try {
        localStorage.setItem(
          key,
          JSON.stringify({
            summary: guideSummary,
            description: guideDescription,
          })
        );
      } catch {
        // Ignore storage errors
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [guideSummary, guideDescription, item.uniqueName, canEdit]);

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

  // Load guide from localStorage on mount
  useEffect(() => {
    if (savedBuildId) return; // Don't load for existing saved builds

    const key = `${GUIDE_STORAGE_KEY_PREFIX}${item.uniqueName}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.summary) setGuideSummary(parsed.summary);
        if (parsed.description) setGuideDescription(parsed.description);
      }
    } catch {
      // Ignore parse errors
    }
  }, [item.uniqueName, savedBuildId]);

  // Fetch available builds for partner selector when in edit mode or creating new build
  useEffect(() => {
    // For existing builds: only fetch when owner
    // For new builds: fetch when authenticated
    if (savedBuildId && !isOwner) return;
    if (!savedBuildId && !isAuthenticated) return;

    getUserBuildsForPartnerSelectorAction().then((result) => {
      if (result.success && result.builds) {
        setAvailableBuilds(result.builds);
      }
    });
  }, [isOwner, savedBuildId, isAuthenticated]);

  // Handler to add a partner build
  const handleAddPartner = useCallback(
    (buildId: string) => {
      const build = availableBuilds.find((b) => b.id === buildId);
      if (build) {
        setPartnerBuilds((prev) => [
          ...prev,
          {
            id: build.id,
            slug: build.slug,
            name: build.name,
            item: build.item,
            buildData: { formaCount: build.buildData.formaCount },
          },
        ]);
      }
    },
    [availableBuilds]
  );

  // Handler to remove a partner build
  const handleRemovePartner = useCallback((buildId: string) => {
    setPartnerBuilds((prev) => prev.filter((b) => b.id !== buildId));
  }, []);

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
  // Aura mods auto-snap to the aura slot regardless of which slot is active
  const handlePlaceMod = useCallback(
    (mod: Mod, rank: number = mod.fusionLimit) => {
      const isAuraMod = mod.compatName?.toUpperCase() === "AURA";

      // Aura mods always go to aura slot, other mods require an active slot
      if (!isAuraMod && !activeSlotId) return;

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

        // Aura mods always go to the aura slot
        if (isAuraMod && newState.auraSlot) {
          newState.auraSlot = { ...newState.auraSlot, mod: placedMod };
          return newState;
        }

        // Find and update the slot
        if (activeSlotId?.startsWith("aura") && newState.auraSlot) {
          newState.auraSlot = { ...newState.auraSlot, mod: placedMod };
        } else if (activeSlotId?.startsWith("exilus")) {
          newState.exilusSlot = { ...newState.exilusSlot, mod: placedMod };
        } else if (activeSlotId) {
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

      // Don't change slot selection if placing an aura mod
      if (isAuraMod) return;

      // Auto-advance to next slot
      const currentIndex = parseInt(activeSlotId?.replace("normal-", "") ?? "");
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
        const clampedRank = Math.max(
          0,
          Math.min(newRank, slot.mod.fusionLimit)
        );
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
  const handleHelminthAbilityChange = useCallback(
    (slotIndex: number, ability: HelminthAbility | null) => {
      setBuildState((prev) => ({
        ...prev,
        helminthAbility: ability
          ? {
              slotIndex,
              ability,
            }
          : undefined,
      }));
    },
    []
  );

  // Save build (authenticated: DB, guest: clipboard fallback)
  const handlePublish = useCallback(
    async (visibility: Visibility) => {
      // For authenticated users, save to database
      if (isAuthenticated) {
        // Track if this is an update (existing build) or new publish
        const isUpdating = !!buildId;

        setSaveStatus("saving");
        setSaveError(null);

        try {
          const result = await saveBuildAction({
            buildId: buildId,
            itemUniqueName: item.uniqueName,
            name: buildName,
            visibility: visibility,
            buildData: { ...buildState, buildName },
            guideSummary: guideSummary.trim() || undefined,
            guideDescription: guideDescription.trim() || undefined,
            partnerBuildIds: partnerBuilds.map((b) => b.id),
          });

          if (result.success && result.build) {
            setBuildId(result.build.id);
            setBuildSlug(result.build.slug);
            setSaveStatus("saved");
            setPublishDialogOpen(false);

            // Clear localStorage on successful save
            try {
              localStorage.removeItem(
                `${STORAGE_KEY_PREFIX}${item.uniqueName}`
              );
              localStorage.removeItem(
                `${GUIDE_STORAGE_KEY_PREFIX}${item.uniqueName}`
              );
            } catch {
              // Ignore storage errors
            }

            // For updates, just exit edit mode (stay on build view)
            // For new builds, redirect to the build page
            if (isUpdating) {
              setIsEditMode(false);
            } else {
              router.push(`/builds/${result.build.slug}`);
            }
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

      // For guests, copy to clipboard as fallback (should not be reached via dialog but safe to keep)
      const success = await copyBuildToClipboard(buildState);
      if (success) {
        setShowCopied(true);
        setTimeout(() => setShowCopied(false), 2000);
        setPublishDialogOpen(false);
      }
    },
    [
      isAuthenticated,
      buildId,
      item.uniqueName,
      buildName,
      buildState,
      router,
      guideSummary,
      guideDescription,
      partnerBuilds,
    ]
  );

  // Cancel editing - for existing builds, exit edit mode; for new builds, go back
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

    // For existing builds, just exit edit mode (stay on build page)
    if (savedBuildId) {
      setIsEditMode(false);
    } else {
      // For new builds, navigate back
      router.back();
    }
  }, [item.uniqueName, router, savedBuildId]);

  // Get all used mod base names for duplicate/variant checking
  const usedModNames = useMemo((): string[] => {
    const names: string[] = [];

    if (buildState.auraSlot?.mod)
      names.push(getModBaseName(buildState.auraSlot.mod.name));
    if (buildState.exilusSlot?.mod)
      names.push(getModBaseName(buildState.exilusSlot.mod.name));

    for (const slot of buildState.normalSlots) {
      if (slot.mod) names.push(getModBaseName(slot.mod.name));
    }

    return names;
  }, [buildState]);

  // Keyboard navigation
  const isWarframeOrNecramech =
    category === "warframes" || category === "necramechs";

  useBuildKeyboard({
    onSelectSlot: handleSelectSlot,
    onOpenSearch: () => {},
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
      <div className="container py-4 md:py-6 px-4">
        {/* Header Card */}
        <div className="bg-card border rounded-lg p-4 mb-4">
          <div className="flex flex-col gap-4 md:flex-row md:gap-4 md:items-center md:justify-between">
            <div className="flex gap-4 items-center">
              <div className="relative w-16 h-16 md:w-24 md:h-24 bg-muted/10 rounded-md flex items-center justify-center overflow-hidden shrink-0">
                <Image
                  src={getImageUrl(item.imageName)}
                  alt={item.name}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col justify-center gap-2">
                <h1 className="text-xl md:text-2xl font-bold tracking-tight">
                  {item.name}
                </h1>
                <span className="text-sm text-muted-foreground">
                  {categoryLabel}
                </span>
                <div className="flex items-center gap-3">
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
            {/* Build Actions */}
            {/* Show Edit button for owners in view mode */}
            {isOwner && !isEditMode && savedBuildId && (
              <div className="flex items-center gap-2">
                <Button
                  variant="default"
                  size="sm"
                  className="gap-2"
                  onClick={() => setIsEditMode(true)}
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </Button>
              </div>
            )}
            {/* Show full editing controls when in edit mode */}
            {canEdit && (
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full md:w-auto">
                {/* Build Name Input (for authenticated users) */}
                {isAuthenticated && (
                  <Input
                    value={buildName}
                    onChange={(e) => setBuildName(e.target.value)}
                    placeholder="Build name..."
                    className="w-full sm:w-48 h-8 text-sm"
                  />
                )}
                <div className="flex gap-2">
                  {isAuthenticated ? (
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-2 flex-1 sm:flex-initial"
                      onClick={() => setPublishDialogOpen(true)}
                      disabled={saveStatus === "saving"}
                    >
                      {saveStatus === "saving" ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : buildId ? (
                        <Save className="w-4 h-4" />
                      ) : (
                        <UploadCloud className="w-4 h-4" />
                      )}
                      <span className="hidden sm:inline">
                        {saveStatus === "saving"
                          ? "Saving..."
                          : saveStatus === "saved"
                          ? "Saved!"
                          : saveStatus === "error"
                          ? "Error"
                          : buildId
                          ? "Update"
                          : "Publish"}
                      </span>
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 flex-1 sm:flex-initial"
                      onClick={handleCopyBuild}
                    >
                      <Save className="w-4 h-4" />
                      <span className="hidden sm:inline">{showCopied ? "Copied!" : "Copy Link"}</span>
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={handleCancel}
                  >
                    <X className="w-4 h-4" />
                    <span className="hidden sm:inline">Cancel</span>
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        <PublishDialog
          open={publishDialogOpen}
          onOpenChange={setPublishDialogOpen}
          onPublish={handlePublish}
          isPublishing={saveStatus === "saving"}
          isUpdate={!!buildId}
        />

        {/* Main Content: Sidebar + Mod Grid (same height) + Search below */}
        <div className="flex flex-col gap-4">
          {/* Top row: Sidebar + Mod Grid - Stack on mobile, side-by-side on desktop */}
          <div className="flex flex-col lg:flex-row gap-4 items-stretch">
            {/* Left Sidebar (Stats) - Full width on mobile, fixed width on desktop */}
            <div className="w-full lg:w-[260px] lg:shrink-0 bg-card border rounded-lg">
              <ItemSidebar
                buildState={buildState}
                capacityStatus={capacityStatus}
                onToggleReactor={handleToggleReactor}
                onCopyBuild={handleCopyBuild}
                onClearBuild={handleClearBuild}
                showCopied={showCopied}
                itemStats={extractItemStats(item)}
                item={item}
                readOnly={!canEdit}
                onHelminthAbilityChange={handleHelminthAbilityChange}
                onPlaceShard={handlePlaceShard}
                onRemoveShard={handleRemoveShard}
              />
            </div>

            {/* Mod Slots Grid - Full width on mobile, flex-1 on desktop */}
            <div className="flex-1 bg-card border rounded-lg p-2 sm:p-4 min-w-0">
              <ModGrid
                auraSlot={buildState.auraSlot}
                exilusSlot={buildState.exilusSlot}
                normalSlots={buildState.normalSlots}
                activeSlotId={canEdit ? activeSlotId : null}
                onSelectSlot={canEdit ? handleSelectSlot : () => {}}
                onRemoveMod={canEdit ? handleRemoveMod : () => {}}
                onChangeRank={canEdit ? handleChangeRank : () => {}}
                onApplyForma={canEdit ? handleApplyForma : () => {}}
                isWarframe={isWarframeOrNecramech}
                draggedMod={
                  canEdit &&
                  (activeDragItem?.type === "search-mod" ||
                    activeDragItem?.type === "placed-mod")
                    ? activeDragItem.mod
                    : undefined
                }
                arcaneSlots={buildState.arcaneSlots}
                onRemoveArcane={canEdit ? handleRemoveArcane : () => {}}
                onChangeArcaneRank={canEdit ? handleChangeArcaneRank : () => {}}
                draggedArcane={
                  (canEdit &&
                    (activeDragItem?.type === "search-arcane"
                      ? activeDragItem.arcane
                      : activeDragItem?.type === "placed-arcane"
                      ? activeDragItem.arcane
                      : undefined)) ||
                  undefined
                }
                arcaneDataMap={arcaneDataMap}
                readOnly={!canEdit}
              />
            </div>
          </div>

          {/* Mod/Arcane Search Grid - only show when editing */}
          {canEdit && (
            <div className="bg-card border rounded-lg p-4">
              {(getSlotType(activeSlotId) === "arcane" ||
                activeDragItem?.type === "search-arcane" ||
                activeDragItem?.type === "placed-arcane") &&
              compatibleArcanes.length > 0 ? (
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

          {/* Build Guide Section */}
          {/* New builds: show inline editor with partner builds */}
          {canEdit && !savedBuildId && (
            <div className="bg-card/50 border rounded-xl overflow-hidden">
              <div className="border-b bg-muted/30 px-6 py-4">
                <h2 className="text-lg font-semibold">Build Guide</h2>
              </div>
              <div className="p-6 space-y-6">
                <InlineGuideEditor
                  summary={guideSummary}
                  description={guideDescription}
                  onSummaryChange={setGuideSummary}
                  onDescriptionChange={setGuideDescription}
                />

                {/* Partner Builds Selector for new builds */}
                {isAuthenticated && (
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium">Partner Builds</h3>
                    <PartnerBuildSelector
                      currentBuildId=""
                      selectedBuilds={partnerBuilds as PartnerBuild[]}
                      availableBuilds={availableBuilds}
                      onAdd={handleAddPartner}
                      onRemove={handleRemovePartner}
                    />
                  </div>
                )}

                <p className="text-xs text-muted-foreground">
                  Your guide will be saved when you publish the build.
                </p>
              </div>
            </div>
          )}

          {/* Existing builds: show editable or read-only guide */}
          {savedBuildId && (
            <div className="bg-card/50 border rounded-xl overflow-hidden">
              <div className="border-b bg-muted/30 px-6 py-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold">Build Guide</h2>
              </div>
              <div className="p-6 space-y-6">
                {canEdit ? (
                  <>
                    {/* Editable guide content */}
                    <InlineGuideEditor
                      summary={guideSummary}
                      description={guideDescription}
                      onSummaryChange={setGuideSummary}
                      onDescriptionChange={setGuideDescription}
                    />

                    {/* Partner Builds Selector */}
                    <div className="space-y-2">
                      <h3 className="text-sm font-medium">Partner Builds</h3>
                      <PartnerBuildSelector
                        currentBuildId={savedBuildId}
                        selectedBuilds={partnerBuilds as PartnerBuild[]}
                        availableBuilds={availableBuilds}
                        onAdd={handleAddPartner}
                        onRemove={handleRemovePartner}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {/* Read-only guide view */}
                    {guideSummary ||
                    guideDescription ||
                    partnerBuilds.length > 0 ? (
                      <>
                        {guideSummary && (
                          <div className="text-muted-foreground">
                            {guideSummary}
                          </div>
                        )}
                        {guideDescription && (
                          <GuideReader content={guideDescription} />
                        )}
                        {partnerBuilds.length > 0 && (
                          <PartnerBuildsSection partnerBuilds={partnerBuilds} />
                        )}
                      </>
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <p>No guide written yet.</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
      <DragOverlay dropAnimation={null}>
        {activeDragItem &&
        (activeDragItem.type === "search-mod" ||
          activeDragItem.type === "placed-mod") ? (
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
                  ("rank" in activeDragItem.mod
                    ? activeDragItem.mod.rank
                    : 0)) >= (activeDragItem.mod.fusionLimit ?? 0)
              }
              disableAnimation
            />
          </div>
        ) : activeDragItem &&
          (activeDragItem.type === "search-arcane" ||
            activeDragItem.type === "placed-arcane") ? (
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
