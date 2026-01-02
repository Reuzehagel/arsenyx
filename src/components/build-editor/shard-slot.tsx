"use client";

import Image from "next/image";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/utils";
import { Plus, X } from "lucide-react";
import type { PlacedShard } from "@/lib/warframe/types";
import {
  getShardImageUrl,
  findStat,
  formatStatValue,
  SHARD_COLOR_NAMES,
} from "@/lib/warframe/shards";

interface ShardSlotProps {
  shard: PlacedShard | null;
  onSelect: () => void;
  onRemove: () => void;
  readOnly?: boolean;
}

export function ShardSlot({
  shard,
  onSelect,
  onRemove,
  readOnly = false,
}: ShardSlotProps) {
  // Get stat info for tooltip
  const stat = shard ? findStat(shard.color, shard.stat) : null;
  const statDisplay = stat ? formatStatValue(stat, shard?.tauforged ?? false) : "";

  // Empty slot
  if (!shard) {
    const emptySlot = (
      <button
        onClick={readOnly ? undefined : onSelect}
        disabled={readOnly}
        className={cn(
          "w-10 h-10 rounded border border-dashed border-border/60 bg-muted/30",
          "flex items-center justify-center transition-all",
          !readOnly && "hover:border-primary/50 hover:bg-muted/50 cursor-pointer",
          readOnly && "cursor-default opacity-60"
        )}
        title={readOnly ? undefined : "Click to add shard"}
      >
        {!readOnly && (
          <Plus className="w-4 h-4 text-muted-foreground/40" />
        )}
      </button>
    );

    if (readOnly) {
      return emptySlot;
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {emptySlot}
          </TooltipTrigger>
          <TooltipContent side="bottom">
            <p>Click to add Archon Shard</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Filled slot with shard
  const shardSlot = (
    <div
      className={cn(
        "relative w-10 h-10 rounded overflow-hidden",
        "border border-border transition-all",
        !readOnly && "cursor-pointer hover:scale-105 hover:border-primary",
        readOnly && "cursor-default"
      )}
      onClick={readOnly ? undefined : onSelect}
    >
      <Image
        src={getShardImageUrl(shard.color, shard.tauforged)}
        alt={`${shard.tauforged ? "Tauforged " : ""}${SHARD_COLOR_NAMES[shard.color]} Archon Shard`}
        fill
        className="object-contain p-0.5"
        unoptimized // Wiki images are external
      />

    </div>
  );

  // Read-only mode - just tooltip, no context menu
  if (readOnly) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            {shardSlot}
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">
                {shard.tauforged ? "Tauforged " : ""}{SHARD_COLOR_NAMES[shard.color]} Shard
              </span>
              <span className="opacity-80 text-xs">
                {shard.stat}: {statDisplay}
              </span>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Editable mode - tooltip + context menu
  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              {shardSlot}
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">
                  {shard.tauforged ? "Tauforged " : ""}{SHARD_COLOR_NAMES[shard.color]} Shard
                </span>
                <span className="opacity-80 text-xs">
                  {shard.stat}: {statDisplay}
                </span>
                <span className="opacity-50 text-[10px] mt-1">
                  Right-click to remove
                </span>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={onSelect}>
          Change Shard
        </ContextMenuItem>
        <ContextMenuItem onClick={onRemove} className="text-destructive">
          <X className="w-4 h-4 mr-2" />
          Remove Shard
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
