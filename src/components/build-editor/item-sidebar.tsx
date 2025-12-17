"use client";

import { useState } from "react";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getImageUrl } from "@/lib/warframe/images";
import type { BuildState, HelminthAbility } from "@/lib/warframe/types";
import type { CapacityStatus } from "@/lib/warframe/capacity";
import { HelminthAbilityDialog } from "./helminth-ability-dialog";

interface ItemStats {
  health?: number;
  shield?: number;
  armor?: number;
  energy?: number;
  sprintSpeed?: number;
  abilities?: Array<{ name: string; imageName?: string }>;
}

interface ItemSidebarProps {
  buildState: BuildState;
  capacityStatus: CapacityStatus;
  onToggleReactor: () => void;
  onCopyBuild: () => void;
  onClearBuild: () => void;
  showCopied: boolean;
  itemStats?: ItemStats;
  readOnly?: boolean;
  onHelminthAbilityChange?: (slotIndex: number, ability: HelminthAbility | null) => void;
}

export function ItemSidebar({
  buildState,
  capacityStatus,
  onToggleReactor,
  itemStats,
  readOnly = false,
  onHelminthAbilityChange,
}: ItemSidebarProps) {
  // Helminth Selection State
  const [selectedAbilityIndex, setSelectedAbilityIndex] = useState<number | null>(null);
  const [isHelminthDialogOpen, setIsHelminthDialogOpen] = useState(false);

  const isWarframeOrNecramech =
    buildState.itemCategory === "warframes" ||
    buildState.itemCategory === "necramechs";

  // Calculate used and max capacity
  const usedCapacity = capacityStatus.max - capacityStatus.remaining;
  const maxCapacity = capacityStatus.max;

  // Get abilities from item stats
  const abilities = itemStats?.abilities ?? [];

  const handleAbilityClick = (index: number) => {
    if (readOnly) return;
    setSelectedAbilityIndex(index);
    setIsHelminthDialogOpen(true);
  };

  const handleHelminthSelect = (ability: HelminthAbility | null) => {
    if (selectedAbilityIndex !== null && onHelminthAbilityChange) {
      onHelminthAbilityChange(selectedAbilityIndex, ability);
    }
    setIsHelminthDialogOpen(false);
  };

  // Helper to get ability to display (replaced or original)
  const getDisplayAbility = (index: number, originalAbility: { name: string; imageName?: string }) => {
    if (
      buildState.helminthAbility &&
      buildState.helminthAbility.slotIndex === index
    ) {
      return {
        ...buildState.helminthAbility.ability,
        isHelminth: true,
      };
    }
    return { ...originalAbility, isHelminth: false };
  };

  return (
    <div className="flex flex-col h-full">
      {/* Abilities */}
      {isWarframeOrNecramech && abilities.length > 0 && (
        <div className="p-3 flex justify-around">
          {abilities.slice(0, 4).map((originalAbility, i) => {
            const displayAbility = getDisplayAbility(i, originalAbility);

            return (
              <button
                key={i}
                className={cn(
                  "w-10 h-10 rounded bg-muted border overflow-hidden relative transition-colors",
                  displayAbility.isHelminth ? "border-destructive" : "border-border",
                  !readOnly && "hover:border-primary hover:cursor-pointer"
                )}
                title={
                  displayAbility.isHelminth
                    ? `${displayAbility.name} (Subsumed from ${displayAbility.source})`
                    : originalAbility.name
                }
                onClick={() => handleAbilityClick(i)}
                disabled={readOnly}
              >
                {displayAbility.imageName ? (
                  <Image
                    src={getImageUrl(displayAbility.imageName)}
                    alt={displayAbility.name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                    {i + 1}
                  </div>
                )}

              </button>
            );
          })}
        </div>
      )}

      <HelminthAbilityDialog
        open={isHelminthDialogOpen}
        onOpenChange={setIsHelminthDialogOpen}
        onSelect={handleHelminthSelect}
        currentAbilityName={
          selectedAbilityIndex !== null
            ? getDisplayAbility(selectedAbilityIndex, abilities[selectedAbilityIndex]).name
            : undefined
        }
      />

      <Separator />

      {/* Capacity */}
      <div className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Reactor</span>
          {!readOnly && (
            <Switch
              checked={buildState.hasReactor}
              onCheckedChange={onToggleReactor}
              className="scale-75 origin-right"
            />
          )}
          {readOnly && (
            <span className="text-sm font-medium">
              {buildState.hasReactor ? "Yes" : "No"}
            </span>
          )}
        </div>

        <div className="space-y-1">
          <div className="h-4 bg-muted rounded-full overflow-hidden relative">
            <div
              className={cn(
                "h-full transition-all duration-200 rounded-full",
                capacityStatus.remaining < 0 ? "bg-destructive" : "bg-primary"
              )}
              style={{
                width: `${Math.min(
                  100,
                  Math.max(0, (usedCapacity / maxCapacity) * 100)
                )}%`,
              }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white mix-blend-difference">
              {usedCapacity}/{maxCapacity}
            </span>
          </div>
        </div>
      </div>

      <Separator />

      {/* Base Stats */}
      <div className="p-3 space-y-2">
        <StatRow
          label="Energy"
          value={itemStats?.energy?.toString() ?? "—"}
        />
        <StatRow
          label="Health"
          value={itemStats?.health?.toString() ?? "—"}
        />
        <StatRow
          label="Shield"
          value={itemStats?.shield?.toString() ?? "—"}
        />
        <StatRow
          label="Armor"
          value={itemStats?.armor?.toString() ?? "—"}
        />
        <StatRow
          label="Sprint Speed"
          value={itemStats?.sprintSpeed?.toFixed(2) ?? "—"}
        />
      </div>

      <Separator />

      {/* Ability Stats */}
      {isWarframeOrNecramech && (
        <div className="p-3 space-y-2">
          <StatRow
            label="Duration"
            value="100%"
          />
          <StatRow
            label="Efficiency"
            value="100%"
          />
          <StatRow
            label="Range"
            value="100%"
          />
          <StatRow
            label="Strength"
            value="100%"
          />
        </div>
      )}
    </div>
  );
}

function StatRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between items-center text-xs">
      <div className="flex items-center gap-2 text-muted-foreground">
        <span>{label}</span>
      </div>
      <span className="font-medium tabular-nums">{value}</span>
    </div>
  );
}
