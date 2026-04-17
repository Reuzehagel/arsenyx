"use client"

import { Plus, X } from "lucide-react"
import Image from "next/image"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import {
  getShardImageUrl,
  findStat,
  formatStatValue,
  SHARD_COLOR_NAMES,
} from "@/lib/warframe/shards"
import type { PlacedShard } from "@/lib/warframe/types"

interface ShardSlotProps {
  shard: PlacedShard | null
  onSelect: () => void
  onRemove: () => void
  readOnly?: boolean
}

export function ShardSlot({
  shard,
  onSelect,
  onRemove,
  readOnly = false,
}: ShardSlotProps) {
  // Get stat info for tooltip
  const stat = shard ? findStat(shard.color, shard.stat) : null
  const statDisplay = stat
    ? formatStatValue(stat, shard?.tauforged ?? false)
    : ""

  // Empty slot
  if (!shard) {
    const emptySlot = (
      <button
        onClick={readOnly ? undefined : onSelect}
        disabled={readOnly}
        className={cn(
          "border-border/60 bg-muted/30 size-10 rounded border border-dashed",
          "flex items-center justify-center transition-colors",
          !readOnly &&
            "hover:border-primary/50 hover:bg-muted/50 cursor-pointer",
          readOnly && "cursor-default opacity-60",
        )}
        title={readOnly ? undefined : "Click to add shard"}
      >
        {!readOnly && <Plus className="text-muted-foreground/40 size-4" />}
      </button>
    )

    if (readOnly) {
      return emptySlot
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={emptySlot} />
          <TooltipContent side="bottom">
            <p>Click to add Archon Shard</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Filled slot with shard
  const shardSlot = (
    <div
      className={cn(
        "relative size-10 overflow-hidden rounded",
        "border-border border transition-[border-color,transform]",
        !readOnly && "hover:border-primary cursor-pointer hover:scale-105",
        readOnly && "cursor-default",
      )}
      onClick={readOnly ? undefined : onSelect}
    >
      <Image
        src={getShardImageUrl(shard.color, shard.tauforged)}
        alt={`${shard.tauforged ? "Tauforged " : ""}${SHARD_COLOR_NAMES[shard.color]} Archon Shard`}
        fill
        sizes="32px"
        className="object-contain p-0.5"
        unoptimized // Wiki images are external
      />
    </div>
  )

  // Read-only mode - just tooltip, no context menu
  if (readOnly) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger render={shardSlot} />
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">
                {shard.tauforged ? "Tauforged " : ""}
                {SHARD_COLOR_NAMES[shard.color]} Shard
              </span>
              <span className="text-xs opacity-80">
                {shard.stat}: {statDisplay}
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Editable mode - tooltip + context menu
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger render={shardSlot} />
            <TooltipContent side="bottom" className="max-w-xs">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">
                  {shard.tauforged ? "Tauforged " : ""}
                  {SHARD_COLOR_NAMES[shard.color]} Shard
                </span>
                <span className="text-xs opacity-80">
                  {shard.stat}: {statDisplay}
                </span>
                <span className="mt-1 text-[10px] opacity-50">
                  Right-click to remove
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onSelect}>Change Shard</ContextMenuItem>
        <ContextMenuItem onClick={onRemove} className="text-destructive">
          <X />
          Remove Shard
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
