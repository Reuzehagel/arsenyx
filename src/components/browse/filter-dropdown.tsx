"use client"

import { useState } from "react"

import { Icons } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

interface FilterDropdownProps {
  masteryMax: number
  primeOnly: boolean
  hideVaulted: boolean
  activeFilterCount: number
  onMasteryChange: (value: number) => void
  onPrimeToggle: () => void
  onVaultedToggle: () => void
  onClearFilters: () => void
}

export function FilterDropdown({
  masteryMax,
  primeOnly,
  hideVaulted,
  activeFilterCount,
  onMasteryChange,
  onPrimeToggle,
  onVaultedToggle,
  onClearFilters,
}: FilterDropdownProps) {
  const [localMastery, setLocalMastery] = useState(masteryMax)

  // Update local state during drag, commit on release
  const handleMasteryDrag = (value: number) => {
    setLocalMastery(value)
  }

  const handleMasteryCommit = (value: number) => {
    onMasteryChange(value)
  }

  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button variant="outline" size="default" className="shrink-0 gap-2" />
        }
      >
        <Icons.filter data-icon="inline-start" />
        Filters
        {activeFilterCount > 0 && (
          <Badge variant="secondary" className="ml-1 text-xs">
            {activeFilterCount}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filters</h4>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClearFilters}
              className={cn(
                "h-auto px-2 py-1 text-xs",
                activeFilterCount === 0 && "invisible",
              )}
            >
              Clear all
            </Button>
          </div>

          {/* Mastery Rank Slider */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Max Mastery Rank</Label>
              <span className="text-muted-foreground text-sm tabular-nums">
                MR {localMastery}
              </span>
            </div>
            <Slider
              value={localMastery}
              onValueChange={handleMasteryDrag}
              onValueCommitted={handleMasteryCommit}
              min={0}
              max={30}
              step={1}
              className="w-full"
            />
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>MR 0</span>
              <span>MR 30</span>
            </div>
          </div>

          {/* Quick Filters */}
          <div className="flex flex-col gap-2">
            <Label className="text-sm">Quick Filters</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={primeOnly ? "default" : "outline"}
                size="sm"
                onClick={onPrimeToggle}
              >
                Prime Only
              </Button>
              <Button
                variant={hideVaulted ? "default" : "outline"}
                size="sm"
                onClick={onVaultedToggle}
              >
                Hide Vaulted
              </Button>
            </div>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
