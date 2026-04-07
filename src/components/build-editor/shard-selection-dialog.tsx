"use client"

import { ArrowLeft } from "lucide-react"
import Image from "next/image"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"
import {
  SHARD_COLORS,
  SHARD_COLOR_NAMES,
  SHARD_STATS,
  getShardImageUrl,
  formatStatValue,
} from "@/lib/warframe/shards"
import type { PlacedShard, ShardColor, ShardStat } from "@/lib/warframe/types"

interface ShardSelectionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (shard: PlacedShard) => void
  currentShard?: PlacedShard | null
  /** Key to reset dialog state - change this when you want to reset */
  dialogKey?: string | number
}

type Step = "color" | "stat"

export function ShardSelectionDialog({
  open,
  onOpenChange,
  onSelect,
  currentShard,
  dialogKey,
}: ShardSelectionDialogProps) {
  // Initialize state from currentShard when dialogKey changes
  const [step, setStep] = useState<Step>("color")
  const [selectedColor, setSelectedColor] = useState<ShardColor | null>(
    currentShard?.color ?? null,
  )
  const [tauforged, setTauforged] = useState(currentShard?.tauforged ?? true)

  // Reset state when dialogKey changes (via key prop on parent)
  const [prevKey, setPrevKey] = useState(dialogKey)
  if (dialogKey !== prevKey) {
    setPrevKey(dialogKey)
    setStep("color")
    setSelectedColor(currentShard?.color ?? null)
    setTauforged(currentShard?.tauforged ?? true)
  }

  const handleColorSelect = (color: ShardColor) => {
    setSelectedColor(color)
    setStep("stat")
  }

  const handleStatSelect = (stat: ShardStat) => {
    if (!selectedColor) return

    onSelect({
      color: selectedColor,
      stat: stat.name,
      tauforged,
    })
    onOpenChange(false)
  }

  const handleBack = () => {
    setStep("color")
  }

  const stats = selectedColor ? SHARD_STATS[selectedColor] : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {step === "stat" && (
              <Button
                variant="ghost"
                size="icon"
                className="mr-1 h-6 w-6"
                onClick={handleBack}
              >
                <ArrowLeft />
              </Button>
            )}
            {step === "color"
              ? "Select Shard Color"
              : `${SHARD_COLOR_NAMES[selectedColor!]} Shard`}
          </DialogTitle>
        </DialogHeader>

        {step === "color" ? (
          // Step 1: Color Selection
          <div className="grid grid-cols-5 gap-3 py-4">
            {SHARD_COLORS.map((color) => (
              <button
                key={color}
                onClick={() => handleColorSelect(color)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg p-2 transition-all",
                  "hover:bg-accent border-2 border-transparent",
                  currentShard?.color === color &&
                    "border-primary bg-accent/50",
                )}
              >
                <div className="border-border relative size-12 overflow-hidden rounded-lg border">
                  <Image
                    src={getShardImageUrl(color, false)}
                    alt={`${SHARD_COLOR_NAMES[color]} Shard`}
                    fill
                    sizes="48px"
                    className="object-contain p-1"
                    unoptimized
                  />
                </div>
                <span className="text-xs font-medium">
                  {SHARD_COLOR_NAMES[color]}
                </span>
              </button>
            ))}
          </div>
        ) : (
          // Step 2: Stat Selection
          <div className="flex flex-col gap-3 py-1">
            {/* Tauforged Toggle */}
            <Field orientation="horizontal" className="bg-muted/50 justify-between rounded px-2 py-1.5">
              <FieldLabel htmlFor="tauforged" className="text-sm">
                Tauforged
              </FieldLabel>
              <Switch
                id="tauforged"
                checked={tauforged}
                onCheckedChange={setTauforged}
                className="scale-90"
              />
            </Field>

            {/* Stats List */}
            <div className="flex flex-col gap-1">
              {stats.map((stat) => (
                <button
                  key={stat.name}
                  onClick={() => handleStatSelect(stat)}
                  className={cn(
                    "flex w-full items-center justify-between rounded px-2 py-1.5 text-sm transition-all",
                    "border-border hover:border-primary/50 hover:bg-accent/50 border",
                    currentShard?.stat === stat.name &&
                      currentShard?.color === selectedColor &&
                      "border-primary bg-accent/50",
                  )}
                >
                  <span>{stat.name}</span>
                  <span className="text-muted-foreground font-mono text-xs">
                    {formatStatValue(stat, tauforged)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
