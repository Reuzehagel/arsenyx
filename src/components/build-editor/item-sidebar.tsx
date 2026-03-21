"use client";

import { useState } from "react";
import Image from "next/image";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getImageUrl } from "@/lib/warframe/images";
import type { BuildState, HelminthAbility, PlacedShard, BrowseableItem } from "@/lib/warframe/types";
import type { CapacityStatus } from "@/lib/warframe/capacity";
import { isWarframeCategory, isWeaponCategory, isGunCategory, isMeleeCategory } from "@/lib/warframe/categories";
import { useCalculatedStats } from "@/hooks/use-calculated-stats";
import { HelminthAbilityDialog } from "./helminth-ability-dialog";
import { ShardsPanel } from "./shards-panel";
import { CalculatedStatRow, SimpleStatRow } from "./stat-row";
import { ConditionalToggle } from "./conditional-toggle";
import { DamageBreakdownSection } from "./damage-breakdown";

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

interface ItemSidebarProps {
  buildState: BuildState;
  capacityStatus: CapacityStatus;
  onToggleReactor: () => void;
  onCopyBuild: () => void;
  onClearBuild: () => void;
  showCopied: boolean;
  itemStats?: ItemStats;
  item?: BrowseableItem; // Full item data for stat calculations
  readOnly?: boolean;
  onHelminthAbilityChange?: (slotIndex: number, ability: HelminthAbility | null) => void;
  onPlaceShard?: (slotIndex: number, shard: PlacedShard) => void;
  onRemoveShard?: (slotIndex: number) => void;
}

export function ItemSidebar({
  buildState,
  capacityStatus,
  onToggleReactor,
  itemStats,
  item,
  readOnly = false,
  onHelminthAbilityChange,
  onPlaceShard,
  onRemoveShard,
}: ItemSidebarProps) {
  // Helminth Selection State
  const [selectedAbilityIndex, setSelectedAbilityIndex] = useState<number | null>(null);
  const [isHelminthDialogOpen, setIsHelminthDialogOpen] = useState(false);

  // Create a fallback item for the hook (required for hooks rules)
  // The actual calculation will only be used if item is provided
  const fallbackItem = {
    uniqueName: "",
    name: "",
    tradable: false,
    health: 0,
    shield: 0,
    armor: 0,
    power: 0,
  };

  // Always call hook (React rules) but use fallback if no item
  const calculatedStatsResult = useCalculatedStats({
    item: item ?? fallbackItem,
    buildState,
  });

  // Only use calculated stats if item was provided
  const calculatedStats = item ? calculatedStatsResult : null;

  const isWarframeOrNecramech = isWarframeCategory(buildState.itemCategory);
  const isWeapon = isWeaponCategory(buildState.itemCategory);
  const isMelee = isMeleeCategory(buildState.itemCategory);
  const isGun = isGunCategory(buildState.itemCategory);

  // Reactor for warframes/necramechs, Catalyst for weapons
  const capacityBoosterLabel = isWarframeOrNecramech ? "Reactor" : "Catalyst";

  // Calculate used and max capacity
  const usedCapacity = capacityStatus.max - capacityStatus.remaining;
  const maxCapacity = capacityStatus.max;

  // Get abilities from item stats
  const abilities = itemStats?.abilities ?? [];

  const isWarframe = buildState.itemCategory === "warframes"; // Specifically warframes, not necramechs

  const handleAbilityClick = (index: number) => {
    if (readOnly || !isWarframe) return;
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
  const getDisplayAbility = (index: number, originalAbility: { name: string; imageName?: string; description: string }) => {
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

  // Get warframe stats from calculated or fallback to base
  const warframeStats = calculatedStats?.stats.warframe;
  const weaponStats = calculatedStats?.stats.weapon;

  return (
    <div className="flex flex-col h-full">
      {/* Abilities */}
      {isWarframeOrNecramech && abilities.length > 0 && (
        <div className="p-3 flex justify-around">
          {abilities.slice(0, 4).map((originalAbility, i) => {
            const displayAbility = getDisplayAbility(i, originalAbility);
            const tooltipDescription = displayAbility.isHelminth && "description" in displayAbility
              ? displayAbility.description
              : originalAbility.description;

            return (
              <Tooltip key={i}>
                <TooltipTrigger render={<button
                    className={cn(
                      "size-10 rounded bg-muted border overflow-hidden relative transition-colors",
                      displayAbility.isHelminth ? "border-destructive" : "border-border",
                      !readOnly && isWarframe ? "hover:border-primary hover:cursor-pointer" : "cursor-default"
                    )}
                    onClick={!readOnly && isWarframe ? () => handleAbilityClick(i) : undefined}
                    type="button"
                  />}>
                    {displayAbility.imageName ? (
                      <Image
                        src={getImageUrl(displayAbility.imageName)}
                        alt={displayAbility.name}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground">
                        {i + 1}
                      </div>
                    )}
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-xs">
                  <p className="font-semibold">{displayAbility.name}</p>
                  {tooltipDescription && (
                    <p className="text-muted-foreground mt-1">{tooltipDescription}</p>
                  )}
                </TooltipContent>
              </Tooltip>
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

      {/* Archon Shards - Warframes only (not Necramechs) */}
      {buildState.itemCategory === "warframes" && onPlaceShard && onRemoveShard && (
        <>
          <Separator />
          <ShardsPanel
            shards={buildState.shardSlots}
            onPlaceShard={onPlaceShard}
            onRemoveShard={onRemoveShard}
            readOnly={readOnly}
          />
        </>
      )}

      {/* Separator after abilities/shards, before capacity - only if there's content above */}
      {isWarframeOrNecramech && <Separator />}

      {/* Capacity */}
      <div className="p-3 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">{capacityBoosterLabel}</span>
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

        <div className="flex flex-col gap-1">
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

      {/* Conditional Toggle - Show when there are conditional mods */}
      {calculatedStats && (
        <ConditionalToggle
          showMaxStacks={calculatedStats.showMaxStacks}
          onToggle={calculatedStats.setShowMaxStacks}
          hasConditionalMods={calculatedStats.hasConditionalMods}
        />
      )}

      <Separator />

      {/* Warframe Base Stats - Calculated */}
      {isWarframeOrNecramech && warframeStats && (
        <div className="p-3 flex flex-col gap-2">
          <CalculatedStatRow
            label="Energy"
            stat={warframeStats.energy}
          />
          <CalculatedStatRow
            label="Health"
            stat={warframeStats.health}
          />
          <CalculatedStatRow
            label="Shield"
            stat={warframeStats.shield}
          />
          <CalculatedStatRow
            label="Armor"
            stat={warframeStats.armor}
          />
          <CalculatedStatRow
            label="Sprint Speed"
            stat={warframeStats.sprintSpeed}
            format="decimal"
          />
        </div>
      )}

      {/* Warframe Base Stats - Fallback to static display */}
      {isWarframeOrNecramech && !warframeStats && (
        <div className="p-3 flex flex-col gap-2">
          <SimpleStatRow
            label="Energy"
            value={itemStats?.energy?.toString() ?? "—"}
          />
          <SimpleStatRow
            label="Health"
            value={itemStats?.health?.toString() ?? "—"}
          />
          <SimpleStatRow
            label="Shield"
            value={itemStats?.shield?.toString() ?? "—"}
          />
          <SimpleStatRow
            label="Armor"
            value={itemStats?.armor?.toString() ?? "—"}
          />
          <SimpleStatRow
            label="Sprint Speed"
            value={itemStats?.sprintSpeed?.toFixed(2) ?? "—"}
          />
        </div>
      )}

      {/* Weapon Stats - Calculated */}
      {isWeapon && weaponStats && weaponStats.attackModes.length > 0 && (
        <div className="p-3 flex flex-col gap-2">
          {/* For multiple attack modes, show shared stats first */}
          {weaponStats.attackModes.length > 1 && (
            <>
              <CalculatedStatRow
                label="Critical Chance"
                stat={weaponStats.attackModes[0].criticalChance}
                format="percent"
              />
              <CalculatedStatRow
                label="Critical Multiplier"
                stat={weaponStats.attackModes[0].criticalMultiplier}
                format="multiplier"
              />
              <CalculatedStatRow
                label="Status Chance"
                stat={weaponStats.attackModes[0].statusChance}
                format="percent"
              />
              <CalculatedStatRow
                label="Fire Rate"
                stat={weaponStats.attackModes[0].fireRate}
                format="decimal"
              />
              {weaponStats.attackModes[0].magazineSize && isGun && (
                <CalculatedStatRow
                  label="Magazine"
                  stat={weaponStats.attackModes[0].magazineSize}
                />
              )}
              {weaponStats.attackModes[0].reloadTime && isGun && (
                <CalculatedStatRow
                  label="Reload Time"
                  stat={weaponStats.attackModes[0].reloadTime}
                  format="decimal"
                  unit="s"
                />
              )}
              {weaponStats.attackModes[0].range && isMelee && (
                <CalculatedStatRow
                  label="Range"
                  stat={weaponStats.attackModes[0].range}
                  format="decimal"
                  unit="m"
                />
              )}
              <CalculatedStatRow
                label="Multishot"
                stat={weaponStats.multishot}
                format="decimal"
                unit="x"
              />
            </>
          )}

          {/* Attack mode stats */}
          {weaponStats.attackModes.map((mode, i) => (
            <div key={i} className="flex flex-col gap-2">
              {/* Separator between sections */}
              {(weaponStats.attackModes.length > 1 || i > 0) && <Separator className="my-2" />}
              {weaponStats.attackModes.length > 1 && (
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {mode.name}
                </span>
              )}
              <CalculatedStatRow
                label="Total Damage"
                stat={mode.totalDamage}
              />
              {/* For single attack mode, show all stats inline */}
              {weaponStats.attackModes.length === 1 && (
                <>
                  <CalculatedStatRow
                    label="Critical Chance"
                    stat={mode.criticalChance}
                    format="percent"
                  />
                  <CalculatedStatRow
                    label="Critical Multiplier"
                    stat={mode.criticalMultiplier}
                    format="multiplier"
                  />
                  <CalculatedStatRow
                    label="Status Chance"
                    stat={mode.statusChance}
                    format="percent"
                  />
                  <CalculatedStatRow
                    label="Fire Rate"
                    stat={mode.fireRate}
                    format="decimal"
                  />
                  {mode.magazineSize && isGun && (
                    <CalculatedStatRow
                      label="Magazine"
                      stat={mode.magazineSize}
                    />
                  )}
                  {mode.reloadTime && isGun && (
                    <CalculatedStatRow
                      label="Reload Time"
                      stat={mode.reloadTime}
                      format="decimal"
                      unit="s"
                    />
                  )}
                  {mode.range && isMelee && (
                    <CalculatedStatRow
                      label="Range"
                      stat={mode.range}
                      format="decimal"
                      unit="m"
                    />
                  )}
                </>
              )}

              {/* Damage breakdown */}
              <DamageBreakdownSection breakdown={mode.damageBreakdown} />
            </div>
          ))}

          {/* Multishot for single attack mode weapons */}
          {weaponStats.attackModes.length === 1 && (
            <>
              <Separator className="my-2" />
              <CalculatedStatRow
                label="Multishot"
                stat={weaponStats.multishot}
                format="decimal"
                unit="x"
              />
            </>
          )}
        </div>
      )}

      {/* Weapon Stats - Fallback to static display */}
      {isWeapon && !weaponStats && (
        <div className="p-3 flex flex-col gap-2">
          <SimpleStatRow
            label="Total Damage"
            value={itemStats?.totalDamage?.toFixed(0) ?? "—"}
          />
          <SimpleStatRow
            label="Critical Chance"
            value={itemStats?.criticalChance != null ? `${(itemStats.criticalChance * 100).toFixed(1)}%` : "—"}
          />
          <SimpleStatRow
            label="Critical Multiplier"
            value={itemStats?.criticalMultiplier != null ? `${itemStats.criticalMultiplier.toFixed(1)}x` : "—"}
          />
          <SimpleStatRow
            label="Status Chance"
            value={itemStats?.procChance != null ? `${(itemStats.procChance * 100).toFixed(1)}%` : "—"}
          />
          <SimpleStatRow
            label="Fire Rate"
            value={itemStats?.fireRate?.toFixed(2) ?? "—"}
          />
          {isGun && (
            <>
              <SimpleStatRow
                label="Magazine"
                value={itemStats?.magazineSize?.toString() ?? "—"}
              />
              <SimpleStatRow
                label="Reload Time"
                value={itemStats?.reloadTime != null ? `${itemStats.reloadTime.toFixed(1)}s` : "—"}
              />
            </>
          )}
          {isMelee && (
            <>
              <SimpleStatRow
                label="Range"
                value={itemStats?.range != null ? `${itemStats.range.toFixed(1)}m` : "—"}
              />
              <SimpleStatRow
                label="Combo Duration"
                value={itemStats?.comboDuration != null ? `${itemStats.comboDuration.toFixed(0)}s` : "—"}
              />
            </>
          )}
        </div>
      )}

      {/* Ability Stats - Calculated */}
      {isWarframeOrNecramech && warframeStats && (
        <>
          <Separator />
          <div className="p-3 flex flex-col gap-2">
            <CalculatedStatRow
              label="Duration"
              stat={warframeStats.abilityDuration}
              format="percent"
            />
            <CalculatedStatRow
              label="Efficiency"
              stat={warframeStats.abilityEfficiency}
              format="percent"
            />
            <CalculatedStatRow
              label="Range"
              stat={warframeStats.abilityRange}
              format="percent"
            />
            <CalculatedStatRow
              label="Strength"
              stat={warframeStats.abilityStrength}
              format="percent"
            />
          </div>
        </>
      )}

      {/* Ability Stats - Fallback to static display */}
      {isWarframeOrNecramech && !warframeStats && (
        <>
          <Separator />
          <div className="p-3 flex flex-col gap-2">
            <SimpleStatRow
              label="Duration"
              value="100%"
            />
            <SimpleStatRow
              label="Efficiency"
              value="100%"
            />
            <SimpleStatRow
              label="Range"
              value="100%"
            />
            <SimpleStatRow
              label="Strength"
              value="100%"
            />
          </div>
        </>
      )}
    </div>
  );
}
