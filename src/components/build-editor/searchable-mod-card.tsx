"use client";

import { useCallback } from "react";
import { cn } from "@/lib/utils";
import { ModCard } from "@/components/mod-card/mod-card";
import type { Mod } from "@/lib/warframe/types";
import { useDraggable } from "@dnd-kit/core";

// =============================================================================
// SEARCHABLE MOD CARD COMPONENT
// =============================================================================

export interface SearchableModCardProps {
  mod: Mod;
  isDisabled?: boolean;
  isSelected?: boolean;
  onSelect: (mod: Mod, rank: number) => void;
  dataIndex?: number;
}

export function SearchableModCard({
  mod,
  isDisabled = false,
  isSelected = false,
  onSelect,
  dataIndex,
}: SearchableModCardProps) {
  const maxRank = mod.fusionLimit ?? 0;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `search-${mod.uniqueName}`,
    data: { mod, rank: maxRank, type: "search-mod" },
    disabled: isDisabled,
  });

  const handleClick = useCallback(() => {
    if (!isDisabled) {
      onSelect(mod, maxRank);
    }
  }, [isDisabled, mod, maxRank, onSelect]);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-index={dataIndex}
      className={cn(
        "search-grid-item relative flex flex-col items-center cursor-pointer transition-all rounded-lg pt-2 px-2 pb-8 group touch-none select-none",
        "bg-card/30 border border-transparent",
        isDisabled && "opacity-40 grayscale cursor-not-allowed",
        isDragging && "opacity-0"
      )}
      onClick={handleClick}
    >
      {/* Always show at max rank */}
      <ModCard
        mod={mod}
        rank={maxRank}
        isSelected={isSelected}
        disableHover={isDragging}
      />
    </div>
  );
}
