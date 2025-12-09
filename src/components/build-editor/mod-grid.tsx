"use client";

import { useState, useMemo } from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { getSlotPolarity } from "@/lib/warframe/capacity";
import { ModCard } from "@/components/mod-card";
import type { ModSlot, Polarity, Mod } from "@/lib/warframe/types";
import { Plus } from "lucide-react";
import { PolarityIcon } from "@/components/icons";

interface ModGridProps {
  auraSlot?: ModSlot;
  exilusSlot: ModSlot;
  normalSlots: ModSlot[];
  activeSlotId: string | null;
  onSelectSlot: (slotId: string) => void;
  onRemoveMod: (slotId: string) => void;
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
  slotNumber?: number;
  className?: string;
  label?: string;
  setCount?: number;
}

function ModSlotCard({
  slot,
  isActive,
  onSelect,
  onRemove,
  className,
  label,
  setCount = 0,
}: ModSlotCardProps) {
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

  // When a mod is present, render without the tooltip to avoid overlay/callout
  if (hasMod && modForCard) {
    return (
      <div
        ref={setDroppableRef}
        className={cn(
          "relative flex items-start justify-center transition-all rounded-lg overflow-visible group",
          className,
          isOver &&
            "ring-2 ring-primary ring-offset-2 ring-offset-background z-10"
        )}
      >
        <div
          ref={setDraggableRef}
          {...listeners}
        {...attributes}
        style={style}
        className="cursor-grab active:cursor-grabbing"
        onClick={onSelect}
        onContextMenu={(e: React.MouseEvent) => {
            e.preventDefault();
            onRemove();
          }}
        >
          <ModCard
            mod={modForCard}
            rank={slot.mod!.rank}
            setCount={setCount}
            disableHover={isDragging}
          />
        </div>
      </div>
    );
  }

  // Empty slot keeps tooltip guidance
  return (
    <TooltipProvider>
      <Tooltip>
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
            onClick={onSelect}
          >
            {/* Polarity Icon (Background) */}
            {polarity && (
              <div className="absolute right-2 top-2 opacity-20 pointer-events-none">
                <PolarityIcon polarity={polarity} size="lg" />
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
        <TooltipContent side="bottom">
          <p>Click to add a mod</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Re-export PolarityIcon from icons for backwards compatibility
export { PolarityIcon } from "@/components/icons";
