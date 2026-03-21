"use client";

import { memo, useMemo } from "react";
import { useDroppable, useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ArcaneCard } from "@/components/arcane-card/arcane-card";
import type { Arcane, PlacedArcane } from "@/lib/warframe/types";
import { Plus } from "lucide-react";

interface ArcaneSlotCardProps {
  arcane?: PlacedArcane;
  slotIndex: number;
  isActive: boolean;
  onSelect: () => void;
  onRemove: () => void;
  onChangeRank: (rank: number) => void;
  className?: string;
  draggedArcane?: Arcane | PlacedArcane;
  /** Full arcane data for display (needed for levelStats) */
  fullArcaneData?: Arcane;
  /** Read-only mode - disables all interactions */
  readOnly?: boolean;
}

export const ArcaneSlotCard = memo(function ArcaneSlotCard({
  arcane,
  slotIndex,
  isActive,
  onSelect,
  onRemove,
  onChangeRank,
  className,
  draggedArcane,
  fullArcaneData,
  readOnly = false,
}: ArcaneSlotCardProps) {
  const hasArcane = !!arcane;
  const slotId = `arcane-${slotIndex}`;

  // Determine if this slot should be disabled for the current drag
  const isDropDisabled = useMemo(() => {
    if (!draggedArcane) return false;
    // Arcane slots accept any arcane (no type restrictions for now)
    return false;
  }, [draggedArcane]);

  // Droppable for the slot (disabled in read-only mode)
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `slot-${slotId}`,
    data: { slotId, slotIndex, type: "arcane-slot" },
    disabled: isDropDisabled || readOnly,
  });

  // Draggable for the placed arcane (disabled in read-only mode)
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `placed-arcane-${slotIndex}`,
    data: { slotIndex, arcane, type: "placed-arcane" },
    disabled: !hasArcane || readOnly,
  });

  const style = transform
    ? {
      transform: CSS.Translate.toString(transform),
      opacity: isDragging ? 0 : 1,
      willChange: "transform",
    }
    : undefined;

  // Convert PlacedArcane to Arcane format for ArcaneCard
  const arcaneForCard: Arcane | null = hasArcane
    ? {
      uniqueName: arcane!.uniqueName,
      name: arcane!.name,
      imageName: arcane!.imageName,
      rarity: (arcane!.rarity || "Common") as Arcane["rarity"],
      type: fullArcaneData?.type || "Arcane",
      tradable: fullArcaneData?.tradable ?? true,
      levelStats: fullArcaneData?.levelStats,
    }
    : null;

  // When an arcane is present
  if (hasArcane && arcaneForCard) {
    return (
      <div
        ref={setDroppableRef}
        className={cn(
          "relative flex items-start justify-center transition-all rounded-lg overflow-visible group",
          className,
          isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background z-10"
        )}
        style={{ isolation: "isolate" }}
      >
        <div
          ref={setDraggableRef}
          {...(readOnly ? {} : listeners)}
          {...(readOnly ? {} : attributes)}
          style={style}
          className={readOnly ? "cursor-default" : "cursor-grab active:cursor-grabbing"}
          onClick={readOnly ? undefined : onSelect}
          onContextMenu={(e: React.MouseEvent) => {
            e.preventDefault();
            if (!readOnly) onRemove();
          }}
        >
          <ArcaneCard
            arcane={arcaneForCard}
            rank={arcane!.rank}
            onRankChange={readOnly ? undefined : onChangeRank}
            disableHover={isDragging}
          />
        </div>
      </div>
    );
  }

  // Empty slot
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<div
            ref={setDroppableRef}
            className={cn(
              "relative flex flex-col items-center justify-center cursor-pointer transition-all rounded-lg overflow-visible group",
              "bg-card border border-dashed border-border/60",
              isActive
                ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                : "hover:ring-1 hover:ring-primary/50",
              isOver && "ring-2 ring-primary ring-offset-2 ring-offset-background bg-accent/50",
              className
            )}
            style={{ isolation: "isolate" }}
            onClick={onSelect}
          />}>
            <Plus className="size-6 text-muted-foreground/20 group-hover:text-muted-foreground/40 transition-colors" />
            {/* Label */}
            <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-wider mt-1">
              Arcane
            </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          <p>Click to add arcane</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
