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
import { getSlotPolarity, calculateModDrain, getMatchState, type MatchState } from "@/lib/warframe/capacity";
import { ModCard } from "@/components/mod-card";
import type { ModSlot, Polarity, Mod } from "@/lib/warframe/types";
import { Plus } from "lucide-react";
import { PolarityIcon } from "@/components/icons";

// All available polarities for the selector
const ALL_POLARITIES: Polarity[] = ["madurai", "vazarin", "naramon", "zenurik", "unairu", "penjaga", "umbra"];

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
}: ModGridProps) {
  const [activeTab, setActiveTab] = useState<"mods" | "shards">("mods");

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
      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted/50 rounded-lg w-fit mb-6">
        <button
          onClick={() => setActiveTab("mods")}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md transition-all",
            activeTab === "mods"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Mods
        </button>
        <button
          onClick={() => setActiveTab("shards")}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-md transition-all",
            activeTab === "shards"
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Shards
        </button>
      </div>

      {activeTab === "mods" ? (
        <div className="flex flex-col gap-4 items-center">
          {/* Row 1: Aura & Exilus */}
          <div className="flex gap-4 w-full justify-center">
            {isWarframe && auraSlot && (
              <ModSlotCard
                slot={auraSlot}
                isActive={activeSlotId === auraSlot.id}
                onSelect={() => onSelectSlot(auraSlot.id)}
                onRemove={() => onRemoveMod(auraSlot.id)}
                onChangeRank={(rank) => onChangeRank(auraSlot.id, rank)}
                onApplyForma={(polarity) => onApplyForma(auraSlot.id, polarity)}
                label="Aura"
                className="w-[184px] h-[100px]"
                setCount={
                  auraSlot.mod?.modSet ? setCounts[auraSlot.mod.modSet] : 0
                }
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
              className="w-[184px] h-[100px]"
              setCount={
                exilusSlot.mod?.modSet ? setCounts[exilusSlot.mod.modSet] : 0
              }
            />
          </div>

          {/* Row 2: Normal Slots 1-4 */}
          <div className="flex gap-4 w-full justify-center">
            {normalSlots.slice(0, 4).map((slot) => (
              <ModSlotCard
                key={slot.id}
                slot={slot}
                isActive={activeSlotId === slot.id}
                onSelect={() => onSelectSlot(slot.id)}
                onRemove={() => onRemoveMod(slot.id)}
                onChangeRank={(rank) => onChangeRank(slot.id, rank)}
                onApplyForma={(polarity) => onApplyForma(slot.id, polarity)}
                className="w-[184px] h-[100px]"
                setCount={slot.mod?.modSet ? setCounts[slot.mod.modSet] : 0}
              />
            ))}
          </div>

          {/* Row 3: Normal Slots 5-8 */}
          <div className="flex gap-4 w-full justify-center">
            {normalSlots.slice(4, 8).map((slot) => (
              <ModSlotCard
                key={slot.id}
                slot={slot}
                isActive={activeSlotId === slot.id}
                onSelect={() => onSelectSlot(slot.id)}
                onRemove={() => onRemoveMod(slot.id)}
                onChangeRank={(rank) => onChangeRank(slot.id, rank)}
                onApplyForma={(polarity) => onApplyForma(slot.id, polarity)}
                className="w-[184px] h-[100px]"
                setCount={slot.mod?.modSet ? setCounts[slot.mod.modSet] : 0}
              />
            ))}
          </div>

          {/* Row 4: Arcanes (Placeholder) */}
          <div className="flex gap-4 w-full justify-center mt-2">
            <div className="w-[184px] h-[100px] border border-dashed rounded-lg flex items-center justify-center text-muted-foreground/30">
              <Plus className="w-5 h-5" />
            </div>
            <div className="w-[184px] h-[100px] border border-dashed rounded-lg flex items-center justify-center text-muted-foreground/30">
              <Plus className="w-5 h-5" />
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Archon Shards coming soon
        </div>
      )}
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
}: ModSlotCardProps) {
  const [polarityOpen, setPolarityOpen] = useState(false);
  const hasMod = !!slot.mod;
  const polarity = getSlotPolarity(slot);

  // Droppable for the slot
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `slot-${slot.id}`,
    data: { slotId: slot.id, type: "slot" },
  });

  // Draggable for the placed mod
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `placed-${slot.id}`,
    data: { slotId: slot.id, mod: slot.mod, type: "placed-mod" },
    disabled: !hasMod,
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
  const drain = hasMod ? calculateModDrain(slot.mod!, polarity) : 0;
  const matchState: MatchState = hasMod ? getMatchState(slot.mod!.polarity, polarity) : "neutral";

  // Polarity selector content (reused for both filled and empty slots)
  const polaritySelectorContent = (
    <PopoverContent className="w-auto p-2" side="bottom" align="center">
      <div className="flex flex-col gap-2">
        <span className="text-xs font-medium text-muted-foreground">Select Polarity</span>
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
      <Popover open={polarityOpen} onOpenChange={setPolarityOpen}>
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
              {...listeners}
              {...attributes}
              style={style}
              className="cursor-grab active:cursor-grabbing"
              onClick={(e) => {
                if (e.shiftKey) {
                  setPolarityOpen(true);
                } else {
                  onSelect();
                }
              }}
              onContextMenu={(e: React.MouseEvent) => {
                e.preventDefault();
                onRemove();
              }}
            >
              <ModCard
                mod={modForCard}
                rank={slot.mod!.rank}
                onRankChange={onChangeRank}
                setCount={setCount}
                disableHover={isDragging || polarityOpen}
                drainOverride={drain}
                matchState={matchState}
              />
            </div>
          </div>
        </PopoverTrigger>
        {polaritySelectorContent}
      </Popover>
    );
  }

  // Empty slot with polarity selector
  return (
    <Popover open={polarityOpen} onOpenChange={setPolarityOpen}>
      <TooltipProvider>
        <Tooltip>
          <PopoverTrigger asChild>
            <TooltipTrigger asChild>
              <div
                ref={setDroppableRef}
                className={cn(
                  "relative flex items-center justify-center cursor-pointer transition-all rounded-lg overflow-visible group",
                  "bg-card border border-dashed border-border/60",
                  isActive
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    : "hover:ring-1 hover:ring-primary/50",
                  isOver &&
                  "ring-2 ring-primary ring-offset-2 ring-offset-background bg-accent/50",
                  className
                )}
                style={{ isolation: "isolate" }}
                onClick={(e) => {
                  if (e.shiftKey) {
                    setPolarityOpen(true);
                  } else {
                    onSelect();
                  }
                }}
                onContextMenu={(e) => {
                  e.preventDefault();
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

                <Plus className="w-5 h-5 text-muted-foreground/20 group-hover:text-muted-foreground/40 transition-colors" />
              </div>
            </TooltipTrigger>
          </PopoverTrigger>
          <TooltipContent side="bottom">
            <p>Click to add mod • Shift+Click or Right-Click for polarity</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {polaritySelectorContent}
    </Popover>
  );
});

// Re-export PolarityIcon from icons for backwards compatibility
export { PolarityIcon } from "@/components/icons";
