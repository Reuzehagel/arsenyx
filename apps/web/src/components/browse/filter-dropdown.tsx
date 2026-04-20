import { useState } from "react"

import { Icons } from "@/components/icons"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Slider } from "@/components/ui/slider"
import { cn } from "@/lib/utils"

export const MASTERY_MAX = 30

interface BrowseFilters {
  masteryMax: number
  primeOnly: boolean
  hideVaulted: boolean
}

const DEFAULT_FILTERS: BrowseFilters = {
  masteryMax: MASTERY_MAX,
  primeOnly: false,
  hideVaulted: false,
}

function activeFilterCount(filters: BrowseFilters): number {
  return [
    filters.masteryMax < MASTERY_MAX,
    filters.primeOnly,
    filters.hideVaulted,
  ].filter(Boolean).length
}

interface FilterDropdownProps {
  filters: BrowseFilters
  onChange: (next: BrowseFilters) => void
}

export function FilterDropdown({ filters, onChange }: FilterDropdownProps) {
  const [localMastery, setLocalMastery] = useState(filters.masteryMax)
  const count = activeFilterCount(filters)

  const handleMasteryCommit = (value: number | readonly number[]) => {
    const v = typeof value === "number" ? value : value[0]
    onChange({ ...filters, masteryMax: v })
  }

  return (
    <Popover>
      <PopoverTrigger
        render={<Button variant="outline" className="shrink-0 gap-2" />}
      >
        <Icons.filter data-icon="inline-start" />
        Filters
        {count > 0 && (
          <Badge variant="secondary" className="ml-1 text-xs">
            {count}
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
              onClick={() => {
                setLocalMastery(MASTERY_MAX)
                onChange(DEFAULT_FILTERS)
              }}
              className={cn(
                "h-auto px-2 py-1 text-xs",
                count === 0 && "invisible",
              )}
            >
              Clear all
            </Button>
          </div>

          <Field>
            <div className="flex items-center justify-between">
              <FieldLabel className="text-sm">Max Mastery Rank</FieldLabel>
              <span className="text-muted-foreground text-sm tabular-nums">
                MR {localMastery}
              </span>
            </div>
            <Slider
              value={localMastery}
              onValueChange={(value) => {
                setLocalMastery(typeof value === "number" ? value : value[0])
              }}
              onValueCommitted={handleMasteryCommit}
              min={0}
              max={MASTERY_MAX}
              step={1}
              className="w-full"
            />
            <div className="text-muted-foreground flex justify-between text-xs">
              <span>MR 0</span>
              <span>MR {MASTERY_MAX}</span>
            </div>
          </Field>

          <Field>
            <FieldLabel className="text-sm">Quick Filters</FieldLabel>
            <div className="flex flex-wrap gap-2">
              <Button
                variant={filters.primeOnly ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  onChange({ ...filters, primeOnly: !filters.primeOnly })
                }
              >
                Prime Only
              </Button>
              <Button
                variant={filters.hideVaulted ? "default" : "outline"}
                size="sm"
                onClick={() =>
                  onChange({ ...filters, hideVaulted: !filters.hideVaulted })
                }
              >
                Hide Vaulted
              </Button>
            </div>
          </Field>
        </div>
      </PopoverContent>
    </Popover>
  )
}
