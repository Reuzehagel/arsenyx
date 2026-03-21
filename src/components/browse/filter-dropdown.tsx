"use client";

import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Icons } from "@/components/icons";

interface FilterDropdownProps {
  masteryMax: number;
  primeOnly: boolean;
  hideVaulted: boolean;
  activeFilterCount: number;
  onMasteryChange: (value: number) => void;
  onPrimeToggle: () => void;
  onVaultedToggle: () => void;
  onClearFilters: () => void;
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
  const [localMastery, setLocalMastery] = useState(masteryMax);

  // Update local state during drag, commit on release
  const handleMasteryDrag = (value: number | readonly number[]) => {
    setLocalMastery(Array.isArray(value) ? value[0] : value);
  };

  const handleMasteryCommit = (value: number | readonly number[]) => {
    onMasteryChange(Array.isArray(value) ? value[0] : value);
  };

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" size="default" className="gap-2 shrink-0" />}>
          <Icons.filter data-icon="inline-start" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="text-xs ml-1">
              {activeFilterCount}
            </Badge>
          )}
      </PopoverTrigger>
      <PopoverContent className="w-80" align="end">
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h4 className="font-medium">Filters</h4>
            {activeFilterCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearFilters}
                className="h-auto py-1 px-2 text-xs"
              >
                Clear all
              </Button>
            )}
          </div>

          {/* Mastery Rank Slider */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Max Mastery Rank</Label>
              <span className="text-sm text-muted-foreground tabular-nums">
                MR {localMastery}
              </span>
            </div>
            <Slider
              value={[localMastery]}
              onValueChange={handleMasteryDrag}
              onValueCommitted={handleMasteryCommit}
              min={0}
              max={30}
              step={1}
              className="w-full"
            />
            <div className="flex justify-between text-xs text-muted-foreground">
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
  );
}
