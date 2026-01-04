"use client";

import { useState, useMemo, memo } from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  getSlotPolarity,
  calculateModDrain,
  calculateAuraBonus,
  getMatchState,
  type MatchState,
} from "@/lib/warframe/capacity";
import { ModCard } from "@/components/mod-card";
import type {
  ModSlot,
  Polarity,
  Mod,
  PlacedMod,
  PlacedArcane,
  Arcane,
} from "@/lib/warframe/types";
import { Plus } from "lucide-react";
import { ArcaneSlotCard } from "./arcane-slot-card";
import { PolarityIcon } from "@/components/icons";

// All available polarities for the selector
const ALL_POLARITIES: Polarity[] = [
  "madurai",
  "vazarin",
  "naramon",
  "zenurik",
  "unairu",
  "penjaga",
  "umbra",
];

interface ModGridProps {
  auraSlot?: ModSlot;
  exilusSlot: ModSlot;
  normalSlots: ModSlot[];
  activeSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
  onRemoveMod: (slotId: string) => void;
  onChangeRank: (slotId: string, rank: number) => void;
  onApplyForma: (slotId: string, polarity: Polarity) => void;
  isWarframe: boolean;
  draggedMod?: Mod | PlacedMod;
  // Arcane props
  arcaneSlots?: PlacedArcane[];
  onRemoveArcane?: (index: number) => void;
  onChangeArcaneRank?: (index: number, rank: number) => void;
  draggedArcane?: Arcane | PlacedArcane;
  /** Full arcane data for hydrating placed arcanes (for levelStats display) */
  arcaneDataMap?: Map<string, Arcane>;
  /** Read-only mode - disables all interactions */
  readOnly?: boolean;
}

export function ModGrid({
  auraSlot,
  exilusSlot,
  normalSlots,
  activeSlotId,
  onSelectSlot,
  onRemoveMod,
  onChangeRank,
  onApplyForma,
  isWarframe,
  draggedMod,
  arcaneSlots = [],
  onRemoveArcane,
  onChangeArcaneRank,
  draggedArcane,
  arcaneDataMap,
  readOnly = false,
}: ModGridProps) {
  // Calculate set counts
  const setCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    const allSlots = [auraSlot, exilusSlot, ...normalSlots].filter(
      Boolean
    ) as ModSlot[];

    for (const slot of allSlots) {
      if (slot.mod?.modSet) {
        counts[slot.mod.modSet] = (counts[slot.mod.modSet] || 0) + 1;
      }
    }
    return counts;
  }, [auraSlot, exilusSlot, normalSlots]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col gap-2 sm:gap-4 items-center">
          {/* Row 1: Aura & Exilus */}
          <div className="flex gap-2 sm:gap-4 w-full justify-center">
            {isWarframe && auraSlot && (
              <ModSlotCard
                slot={auraSlot}
                isActive={activeSlotId === auraSlot.id}
                onSelect={() => onSelectSlot(auraSlot.id)}
                onRemove={() => onRemoveMod(auraSlot.id)}
                onChangeRank={(rank) => onChangeRank(auraSlot.id, rank)}
                onApplyForma={(polarity) => onApplyForma(auraSlot.id, polarity)}
                label="Aura"
                className="w-[120px] h-[80px] sm:w-[150px] sm:h-[90px] md:w-[184px] md:h-[100px]"
                setCount={
                  auraSlot.mod?.modSet ? setCounts[auraSlot.mod.modSet] : 0
                }
                draggedMod={draggedMod}
                readOnly={readOnly}
              />
            )}
            <ModSlotCard
              slot={exilusSlot}
              isActive={activeSlotId === exilusSlot.id}
              onSelect={() => onSelectSlot(exilusSlot.id)}
              onRemove={() => onRemoveMod(exilusSlot.id)}
              onChangeRank={(rank) => onChangeRank(exilusSlot.id, rank)}
              onApplyForma={(polarity) => onApplyForma(exilusSlot.id, polarity)}
              label="Exilus"
              className="w-[120px] h-[80px] sm:w-[150px] sm:h-[90px] md:w-[184px] md:h-[100px]"
              setCount={
                exilusSlot.mod?.modSet ? setCounts[exilusSlot.mod.modSet] : 0
              }
              draggedMod={draggedMod}
              readOnly={readOnly}
            />
          </div>

          {/* Row 2: Normal Slots 1-4 */}
          <div className="grid grid-cols-2 sm:flex sm:gap-4 gap-2 w-full justify-center">
            {normalSlots.slice(0, 4).map((slot) => (
              <ModSlotCard
                key={slot.id}
                slot={slot}
                isActive={activeSlotId === slot.id}
                onSelect={() => onSelectSlot(slot.id)}
                onRemove={() => onRemoveMod(slot.id)}
                onChangeRank={(rank) => onChangeRank(slot.id, rank)}
                onApplyForma={(polarity) => onApplyForma(slot.id, polarity)}
                className="w-full sm:w-[150px] sm:h-[90px] md:w-[184px] md:h-[100px] h-[80px]"
                setCount={slot.mod?.modSet ? setCounts[slot.mod.modSet] : 0}
                draggedMod={draggedMod}
                readOnly={readOnly}
              />
            ))}
          </div>

          {/* Row 3: Normal Slots 5-8 */}
          <div className="grid grid-cols-2 sm:flex sm:gap-4 gap-2 w-full justify-center">
            {normalSlots.slice(4, 8).map((slot) => (
              <ModSlotCard
                key={slot.id}
                slot={slot}
                isActive={activeSlotId === slot.id}
                onSelect={() => onSelectSlot(slot.id)}
                onRemove={() => onRemoveMod(slot.id)}
                onChangeRank={(rank) => onChangeRank(slot.id, rank)}
                onApplyForma={(polarity) => onApplyForma(slot.id, polarity)}
                className="w-full sm:w-[150px] sm:h-[90px] md:w-[184px] md:h-[100px] h-[80px]"
                setCount={slot.mod?.modSet ? setCounts[slot.mod.modSet] : 0}
                draggedMod={draggedMod}
                readOnly={readOnly}
              />
            ))}
          </div>

          {/* Row 4: Arcanes */}
          {arcaneSlots.length > 0 && (
            <div className="flex gap-3 sm:gap-6 w-full justify-center mt-2">
              {arcaneSlots.map((arcane, index) => (
                <ArcaneSlotCard
                  key={`arcane-${index}`}
                  arcane={arcane}
                  slotIndex={index}
                  isActive={activeSlotId === `arcane-${index}`}
                  onSelect={() => onSelectSlot(`arcane-${index}`)}
                  onRemove={() => onRemoveArcane?.(index)}
                  onChangeRank={(rank) => onChangeArcaneRank?.(index, rank)}
                  className="w-[100px] h-[80px] sm:w-[120px] sm:h-[90px] md:w-[140px] md:h-[100px]"
                  draggedArcane={draggedArcane}
                  fullArcaneData={
                    arcane
                      ? arcaneDataMap?.get(arcane.uniqueName)
                      : undefined
                  }
                  readOnly={readOnly}
                />
              ))}
            </div>
          )}
      </div>
    </div>
  );
}

// =============================================================================
// MOD SLOT CARD COMPONENT
// =============================================================================

interface ModSlotCardProps {
  slot: ModSlot;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onChangeRank: (rank: number) => void;
  onApplyForma: (polarity: Polarity) => void;
  slotNumber?: number;
  className?: string;
  label?: string;
  setCount?: number;
  draggedMod?: Mod | PlacedMod;
  readOnly?: boolean;
}

const ModSlotCard = memo(function ModSlotCard({
  slot,
  isActive,
  onSelect,
  onRemove,
  onChangeRank,
  onApplyForma,
  className,
  label,
  setCount = 0,
  draggedMod,
  readOnly = false,
}: ModSlotCardProps) {
  const [polarityOpen, setPolarityOpen] = useState(false);
  const hasMod = !!slot.mod;
  const polarity = getSlotPolarity(slot);

  // Determine if this slot should be disabled for the current drag
  const isDropDisabled = useMemo(() => {
    if (!draggedMod) return false;

    // Aura slot check
    if (slot.type === "aura" && slot.id.startsWith("aura")) {
      const isAura =
        draggedMod.type?.toLowerCase().includes("aura") ||
        draggedMod.compatName?.toLowerCase() === "aura";
      return !isAura;
    }

    // Exilus slot check
    if (slot.type === "exilus" && slot.id.startsWith("exilus")) {
      return !draggedMod.isExilus;
    }

    // Normal slots accept everything (except maybe Aura?)
    // Technically Aura mods can go in normal slots in game, but users usually don't want to.
    // Logic in BuildContainer doesn't restrict Aura->Normal.
    // If we want to be strict, we can add logic here, but keeping it permissive for normal slots is safer.
    return false;
  }, [draggedMod, slot.type, slot.id]);

  // Droppable for the slot (disabled in read-only mode)
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `slot-${slot.id}`,
    data: { slotId: slot.id, type: "slot" },
    disabled: isDropDisabled || readOnly,
  });

  // Draggable for the placed mod (disabled in read-only mode)
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `placed-${slot.id}`,
    data: { slotId: slot.id, mod: slot.mod, type: "placed-mod" },
    disabled: !hasMod || readOnly,
  });

  const style = transform
    ? {
      transform: CSS.Translate.toString(transform),
      opacity: isDragging ? 0 : 1,
      willChange: "transform",
    }
    : undefined;

  // Convert PlacedMod to Mod format for ModCard
  const modForCard: Mod | null = hasMod
    ? {
      uniqueName: slot.mod!.uniqueName,
      name: slot.mod!.name,
      imageName: slot.mod!.imageName,
      polarity: slot.mod!.polarity,
      rarity: (slot.mod!.rarity || "Common") as Mod["rarity"],
      baseDrain: slot.mod!.baseDrain,
      fusionLimit: slot.mod!.fusionLimit,
      compatName: slot.mod!.compatName,
      type: slot.mod!.type || "",
      levelStats: slot.mod!.levelStats,
      modSet: slot.mod!.modSet,
      modSetStats: slot.mod!.modSetStats,
      tradable: false,
    }
    : null;

  // Calculate drain and match state for polarity color feedback
  const drain = hasMod
    ? slot.type === "aura"
      ? calculateAuraBonus(slot.mod!, polarity)
      : calculateModDrain(slot.mod!, polarity)
    : 0;
  const matchState: MatchState = hasMod
    ? getMatchState(slot.mod!.polarity, polarity)
    : "neutral";

  // Polarity selector content (reused for both filled and empty slots)
  const polaritySelectorContent = (
    <PopoverContent className="w-auto p-2" side="bottom" align="center">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          Select Polarity
        </span>
        <div className="flex gap-1 flex-wrap">
          {ALL_POLARITIES.map((p) => (
            <button
              key={p}
              onClick={() => {
                onApplyForma(p);
                setPolarityOpen(false);
              }}
              className={cn(
                "p-1.5 rounded hover:bg-accent transition-colors",
                polarity === p && "ring-1 ring-primary bg-accent"
              )}
              title={p}
            >
              <PolarityIcon polarity={p} size="sm" />
            </button>
          ))}
          {/* Clear/None option */}
          <button
            onClick={() => {
              // Pass undefined/neutral to clear the forma polarity
              onApplyForma("universal" as Polarity);
              setPolarityOpen(false);
            }}
            className={cn(
              "p-1.5 rounded hover:bg-accent transition-colors text-xs text-muted-foreground",
              !polarity && "ring-1 ring-primary bg-accent"
            )}
            title="None (clear polarity)"
          >
            <span className="w-4 h-4 flex items-center justify-center">✕</span>
          </button>
        </div>
      </div>
    </PopoverContent>
  );

  // When a mod is present, render with polarity popover
  if (hasMod && modForCard) {
    return (
      <Popover open={readOnly ? false : polarityOpen} onOpenChange={readOnly ? undefined : setPolarityOpen}>
        <PopoverTrigger asChild>
          <div
            ref={setDroppableRef}
            className={cn(
              "relative flex items-start justify-center transition-all rounded-lg overflow-visible group",
              className,
              isOver &&
              "ring-2 ring-primary ring-offset-2 ring-offset-background z-10"
            )}
            style={{ isolation: "isolate" }}
          >
            <div
              ref={setDraggableRef}
              {...(readOnly ? {} : listeners)}
              {...(readOnly ? {} : attributes)}
              style={style}
              className={readOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing"}
              onClick={(e) => {
                if (readOnly) return;
                if (e.shiftKey) {
                  setPolarityOpen(true);
                } else {
                  onSelect();
                }
              }}
              onContextMenu={(e: React.MouseEvent) => {
                e.preventDefault();
                if (readOnly) return;
                onRemove();
              }}
            >
              <ModCard
                mod={modForCard}
                rank={slot.mod!.rank}
                onRankChange={readOnly ? undefined : onChangeRank}
                setCount={setCount}
                disableHover={isDragging || polarityOpen}
                drainOverride={drain}
                matchState={matchState}
              />
            </div>
          </div>
        </PopoverTrigger>
        {!readOnly && polaritySelectorContent}
      </Popover>
    );
  }

  // Empty slot content (shared between tooltip and non-tooltip versions)
  const emptySlotContent = (
    <div
      ref={setDroppableRef}
      className={cn(
        "relative flex items-center justify-center transition-all rounded-lg overflow-visible group",
        readOnly ? "cursor-default" : "cursor-pointer",
        "bg-card border border-dashed border-border/60",
        !readOnly && isActive
          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
          : !readOnly && "hover:ring-1 hover:ring-primary/50",
        isOver &&
        "ring-2 ring-primary ring-offset-2 ring-offset-background bg-accent/50",
        className
      )}
      style={{ isolation: "isolate" }}
      onClick={(e) => {
        if (readOnly) return;
        if (e.shiftKey) {
          setPolarityOpen(true);
        } else {
          onSelect();
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        if (readOnly) return;
        setPolarityOpen(true);
      }}
    >
      {/* Polarity Icon (Background) */}
      {polarity && (
        <div className="absolute right-2 top-2 opacity-30 pointer-events-none">
          <PolarityIcon polarity={polarity} size="sm" />
        </div>
      )}

      {/* Label (Aura/Exilus) */}
      {label && (
        <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider">
          {label}
        </span>
      )}

      {!readOnly && <Plus className="w-5 h-5 text-muted-foreground/20 group-hover:text-muted-foreground/40 transition-colors" />}
    </div>
  );

  // In read-only mode, just render the slot without tooltip/popover
  if (readOnly) {
    return emptySlotContent;
  }

  // Empty slot with polarity selector and tooltip
  return (
    <Popover open={polarityOpen} onOpenChange={setPolarityOpen}>
      <TooltipProvider>
        <Tooltip>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              {emptySlotContent}
            </TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent side="bottom">
            <p>Click to add mod</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {polaritySelectorContent}
    </Popover>
  );
});

// Re-export PolarityIcon from icons for backwards compatibility
export { PolarityIcon } from "@/components/icons";
