"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import Image from "next/image";
import { ItemSidebar } from "./item-sidebar";
import { ModGrid } from "./mod-grid";
import { ModSearchPanel } from "./mod-search-panel";
import { useBuildKeyboard } from "./use-build-keyboard";
import { getCapacityStatus } from "@/lib/warframe/capacity";
import { copyBuildToClipboard } from "@/lib/build-codec";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import { Hexagon, Diamond } from "lucide-react";

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

// Create initial mod slots
function createInitialSlots(): ModSlot[] {
  // In the future, different categories may have different default polarities
  return Array.from({ length: 8 }, (_, i) => ({
    id: `normal-${i}`,
    type: "normal" as const,
  }));
}

// Create initial build state
function createInitialBuildState(
  item: BrowseableItem,
  category: BrowseCategory,
  importedBuild?: Partial<BuildState>
): BuildState {
  const isWarframe = category === "warframes" || category === "necramechs";

  const baseState: BuildState = {
    itemUniqueName: item.uniqueName,
    itemName: item.name,
    itemCategory: category,
    itemImageName: item.imageName,
    hasReactor: false,
    exilusSlot: { id: "exilus-0", type: "exilus" },
    normalSlots: createInitialSlots(),
    arcaneSlots: [],
    baseCapacity: 30,
    currentCapacity: 30,
  };

  // Add aura slot for warframes
  if (isWarframe) {
    baseState.auraSlot = { id: "aura-0", type: "aura" };
    baseState.arcaneSlots = [];
  }

  // Apply imported build data if available
  if (importedBuild) {
    return {
      ...baseState,
      ...importedBuild,
      // Ensure these are always from base state
      itemUniqueName: item.uniqueName,
      itemName: item.name,
      itemCategory: category,
      itemImageName: item.imageName,
    };
  }

  return baseState;
}

// Local storage key for auto-save
const STORAGE_KEY_PREFIX = "arsenix_build_";

export function BuildContainer({
  item,
  category,
  categoryLabel: _categoryLabel,
  compatibleMods,
  importedBuild,
}: BuildContainerProps) {
  // Build state
  const [buildState, setBuildState] = useState<BuildState>(() =>
    createInitialBuildState(item, category, importedBuild)
  );

  // Active slot for mod placement
  const [activeSlotId, setActiveSlotId] = useState<string | null>(null);

  // Search panel visibility
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // Copy notification
  const [showCopied, setShowCopied] = useState(false);

  // Calculate capacity
  const capacityStatus = getCapacityStatus(buildState);

  // Auto-save to localStorage
  useEffect(() => {
    const key = `${STORAGE_KEY_PREFIX}${item.uniqueName}`;
    try {
      localStorage.setItem(key, JSON.stringify(buildState));
    } catch {
      // Ignore storage errors
    }
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
    setIsSearchOpen(true);
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
        setIsSearchOpen(false);
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

  // Apply forma to a slot
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
    setBuildState(createInitialBuildState(item, category));
    setActiveSlotId(null);
    setIsSearchOpen(false);
  }, [item, category]);

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
    isSearchOpen,
    onSelectSlot: handleSelectSlot,
    onOpenSearch: () => setIsSearchOpen(true),
    onCloseSearch: () => {
      setIsSearchOpen(false);
      setActiveSlotId(null);
    },
    onCopyBuild: handleCopyBuild,
    onClearBuild: handleClearBuild,
    onToggleReactor: handleToggleReactor,
    hasAuraSlot: isWarframeOrNecramech,
  });

  return (
    <div className="container py-8 max-w-[1440px]">
      <div className="flex gap-4 items-start">
        {/* Main Build Card */}
        <div className="flex-1 bg-card border rounded-lg shadow-sm p-6 min-h-[760px]">
          {/* Header */}
          <div className="flex gap-4 mb-6">
            <div className="relative w-32 h-32 bg-muted/10 rounded-md flex items-center justify-center overflow-hidden border">
              <Image
                src={getImageUrl(item.imageName)}
                alt={item.name}
                fill
                className="object-cover"
              />
            </div>
            <div className="flex flex-col justify-center gap-3">
              <h1 className="text-3xl font-bold tracking-tight">{item.name}</h1>
              <div className="flex items-center gap-3">
                {/* Capacity indicator */}
                <Badge
                  variant="secondary"
                  className={cn(
                    "gap-1.5 px-2 py-1 h-6 font-semibold",
                    capacityStatus.isOverCapacity
                      ? "bg-destructive/20 text-destructive hover:bg-destructive/30"
                      : "bg-muted/50 hover:bg-muted"
                  )}
                >
                  <Hexagon className="w-3 h-3 fill-current" />
                  {capacityStatus.remaining}/{capacityStatus.max}
                </Badge>
                {/* Reactor status */}
                <Badge
                  variant="secondary"
                  className={cn(
                    "gap-1.5 px-2 py-1 h-6 font-semibold",
                    buildState.hasReactor
                      ? "bg-primary/20 text-primary hover:bg-primary/30"
                      : "bg-muted/50 hover:bg-muted"
                  )}
                >
                  <Diamond className="w-3 h-3 fill-current" />
                  {buildState.hasReactor ? "Reactor" : "No Reactor"}
                </Badge>
              </div>
            </div>
          </div>

          {/* Editor Area */}
          <div className="flex gap-3 h-full">
            {/* Left Sidebar (Stats) */}
            <div className="w-[240px] shrink-0 bg-card border rounded-lg shadow-sm flex flex-col">
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

            {/* Mod Grid Area */}
            <div className="flex-1 bg-card border rounded-lg shadow-sm p-3">
              <ModGrid
                auraSlot={buildState.auraSlot}
                exilusSlot={buildState.exilusSlot}
                normalSlots={buildState.normalSlots}
                activeSlotId={activeSlotId}
                onSelectSlot={handleSelectSlot}
                onRemoveMod={handleRemoveMod}
                onApplyForma={handleApplyForma}
                isWarframe={isWarframeOrNecramech}
              />
            </div>
          </div>
        </div>

        {/* Right Search Panel */}
        <div className="w-[360px] shrink-0">
          <ModSearchPanel
            isOpen={true}
            onClose={() => setIsSearchOpen(false)}
            onSelectMod={handlePlaceMod}
            availableMods={compatibleMods}
            slotType={getSlotType(activeSlotId)}
            usedModNames={usedModNames}
          />
        </div>
      </div>
    </div>
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
