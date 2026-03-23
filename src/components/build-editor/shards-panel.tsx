"use client"

import { useState } from "react"

import type { PlacedShard } from "@/lib/warframe/types"

import { ShardSelectionDialog } from "./shard-selection-dialog"
import { ShardSlot } from "./shard-slot"

interface ShardsPanelProps {
  shards: (PlacedShard | null)[]
  onPlaceShard: (slotIndex: number, shard: PlacedShard) => void
  onRemoveShard: (slotIndex: number) => void
  readOnly?: boolean
}

export function ShardsPanel({
  shards,
  onPlaceShard,
  onRemoveShard,
  readOnly = false,
}: ShardsPanelProps) {
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(
    null,
  )
  const [dialogOpen, setDialogOpen] = useState(false)

  const handleSlotSelect = (index: number) => {
    if (readOnly) return
    setSelectedSlotIndex(index)
    setDialogOpen(true)
  }

  const handleSlotRemove = (index: number) => {
    if (readOnly) return
    onRemoveShard(index)
  }

  const handleShardSelect = (shard: PlacedShard) => {
    if (selectedSlotIndex !== null) {
      onPlaceShard(selectedSlotIndex, shard)
    }
    setDialogOpen(false)
    setSelectedSlotIndex(null)
  }

  // Ensure we always have 5 slots
  const normalizedShards = Array.from(
    { length: 5 },
    (_, i) => shards[i] ?? null,
  )

  return (
    <div className="p-3">
      <div className="flex justify-around">
        {normalizedShards.map((shard, index) => (
          <ShardSlot
            key={index}
            shard={shard}
            onSelect={() => handleSlotSelect(index)}
            onRemove={() => handleSlotRemove(index)}
            readOnly={readOnly}
          />
        ))}
      </div>

      <ShardSelectionDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSelect={handleShardSelect}
        currentShard={
          selectedSlotIndex !== null
            ? normalizedShards[selectedSlotIndex]
            : null
        }
        dialogKey={selectedSlotIndex ?? undefined}
      />
    </div>
  )
}
