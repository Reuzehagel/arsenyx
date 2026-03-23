"use client"

import { useDraggable } from "@dnd-kit/core"
import { useCallback } from "react"

import { ModCard } from "@/components/mod-card/mod-card"
import { cn } from "@/lib/utils"
import type { Mod } from "@/lib/warframe/types"

// =============================================================================
// SEARCHABLE MOD CARD COMPONENT
// =============================================================================

export interface SearchableModCardProps {
  mod: Mod
  isDisabled?: boolean
  isSelected?: boolean
  onSelect: (mod: Mod, rank: number) => void
  dataIndex?: number
}

export function SearchableModCard({
  mod,
  isDisabled = false,
  isSelected = false,
  onSelect,
  dataIndex,
}: SearchableModCardProps) {
  const maxRank = mod.fusionLimit ?? 0

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `search-${mod.uniqueName}`,
    data: { mod, rank: maxRank, type: "search-mod" },
    disabled: isDisabled,
  })

  const handleClick = useCallback(() => {
    if (!isDisabled) {
      onSelect(mod, maxRank)
    }
  }, [isDisabled, mod, maxRank, onSelect])

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-index={dataIndex}
      className={cn(
        "search-grid-item group relative flex cursor-pointer touch-none flex-col items-center rounded-lg px-2 pt-2 pb-8 transition-all select-none",
        "bg-card/30 border border-transparent",
        isDisabled && "cursor-not-allowed opacity-40 grayscale",
        isDragging && "opacity-0",
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
  )
}
