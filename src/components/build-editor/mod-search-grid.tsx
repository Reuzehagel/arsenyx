"use client";

import {
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useState,
  useDeferredValue,
} from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { SearchableModCard } from "./searchable-mod-card";
import type { Mod, SlotType } from "@/lib/warframe/types";

// =============================================================================
// CONSTANTS
// =============================================================================

// Rarity order for sorting
const RARITY_ORDER: Record<string, number> = {
  Legendary: 0,
  Rare: 1,
  Uncommon: 2,
  Common: 3,
  Peculiar: 4,
};

// Available filter options
const RARITY_OPTIONS = [
  "All",
  "Legendary",
  "Rare",
  "Uncommon",
  "Common",
] as const;
const POLARITY_OPTIONS = [
  "All",
  "Madurai",
  "Vazarin",
  "Naramon",
  "Zenurik",
  "Unairu",
  "Penjaga",
  "Umbra",
] as const;
const SORT_OPTIONS = ["Name", "Drain", "Rarity"] as const;

type RarityFilter = (typeof RARITY_OPTIONS)[number];
type PolarityFilter = (typeof POLARITY_OPTIONS)[number];
type SortOption = (typeof SORT_OPTIONS)[number];

// =============================================================================
// MOD SEARCH GRID COMPONENT
// =============================================================================

interface ModSearchGridProps {
  availableMods: Mod[];
  slotType: SlotType;
  usedModNames: string[];
  onSelectMod: (mod: Mod, rank: number) => void;
  className?: string;
}

export function ModSearchGrid({
  availableMods,
  slotType,
  usedModNames,
  onSelectMod,
  className,
}: ModSearchGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("Name");
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("All");
  const [polarityFilter, setPolarityFilter] = useState<PolarityFilter>("All");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Filter and sort mods
  const filteredMods = useMemo(() => {
    let mods = [...availableMods];

    // Filter by slot type
    if (slotType === "aura") {
      mods = mods.filter((m) => m.compatName?.toUpperCase() === "AURA");
    } else if (slotType === "exilus") {
      mods = mods.filter((m) => m.isExilus);
    } else if (slotType === "normal") {
      mods = mods.filter((m) => m.compatName?.toUpperCase() !== "AURA");
    }

    // Filter by search query
    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase();
      mods = mods.filter(
        (m) =>
          m.name.toLowerCase().includes(query) ||
          m.description?.toLowerCase().includes(query)
      );
    }

    // Filter by rarity
    if (rarityFilter !== "All") {
      mods = mods.filter((m) => m.rarity === rarityFilter);
    }

    // Filter by polarity
    if (polarityFilter !== "All") {
      mods = mods.filter(
        (m) => m.polarity.toLowerCase() === polarityFilter.toLowerCase()
      );
    }

    // Sort
    switch (sortBy) {
      case "Name":
        mods.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "Drain":
        mods.sort((a, b) => b.baseDrain - a.baseDrain);
        break;
      case "Rarity":
        mods.sort((a, b) => {
          const rarityDiff =
            (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99);
          if (rarityDiff !== 0) return rarityDiff;
          return a.name.localeCompare(b.name);
        });
        break;
    }

    return mods;
  }, [
    availableMods,
    deferredSearchQuery,
    sortBy,
    rarityFilter,
    polarityFilter,
    slotType,
  ]);

  // Compute bounded selected index
  const boundedSelectedIndex = Math.min(
    selectedIndex,
    Math.max(0, filteredMods.length - 1)
  );

  // Check if a mod is already used
  const isModUsed = useCallback(
    (mod: Mod) => usedModNames.includes(mod.name),
    [usedModNames]
  );

  // Handle mod selection
  const handleSelectMod = useCallback(
    (mod: Mod, rank: number) => {
      if (!isModUsed(mod)) {
        onSelectMod(mod, rank);
      }
    },
    [isModUsed, onSelectMod]
  );

  // Keyboard navigation for grid
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const grid = gridRef.current;
      if (!grid) return;

      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          // If in top row (even index), go to bottom row (index + 1)
          if (boundedSelectedIndex % 2 === 0) {
            const nextIndex = boundedSelectedIndex + 1;
            if (nextIndex < filteredMods.length) {
              setSelectedIndex(nextIndex);
            }
          }
          break;
        case "ArrowUp":
          e.preventDefault();
          // If in bottom row (odd index), go to top row (index - 1)
          if (boundedSelectedIndex % 2 !== 0) {
            setSelectedIndex(boundedSelectedIndex - 1);
          }
          break;
        case "ArrowRight":
          e.preventDefault();
          // Go to next column (index + 2)
          setSelectedIndex((prev) =>
            Math.min(prev + 2, filteredMods.length - 1)
          );
          break;
        case "ArrowLeft":
          e.preventDefault();
          // Go to prev column (index - 2)
          setSelectedIndex((prev) => Math.max(prev - 2, 0));
          break;
        case "Enter":
          e.preventDefault();
          const selectedMod = filteredMods[boundedSelectedIndex];
          if (selectedMod && !isModUsed(selectedMod)) {
            // Use max rank by default when pressing Enter
            handleSelectMod(selectedMod, selectedMod.fusionLimit ?? 0);
          }
          break;
      }
    },
    [filteredMods, boundedSelectedIndex, isModUsed, handleSelectMod]
  );

  // Scroll selected item into view
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;

    const selectedItem = grid.querySelector(
      `[data-index="${boundedSelectedIndex}"]`
    );
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: "nearest", inline: "nearest" });
    }
  }, [boundedSelectedIndex]);

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Search and Filter Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search Input */}
        <div className="relative flex-1">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <Input
            ref={inputRef}
            placeholder="Search mods..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9 bg-muted/50 border-border/50"
          />
        </div>

        {/* Filter Dropdowns */}
        <div className="flex gap-2 flex-wrap">
          <FilterDropdown
            label={sortBy}
            options={[...SORT_OPTIONS]}
            value={sortBy}
            onChange={(v: string) => setSortBy(v as SortOption)}
          />
          <FilterDropdown
            label={rarityFilter === "All" ? "Rarity" : rarityFilter}
            options={[...RARITY_OPTIONS]}
            value={rarityFilter}
            onChange={(v: string) => setRarityFilter(v as RarityFilter)}
          />
          <FilterDropdown
            label={polarityFilter === "All" ? "Polarity" : polarityFilter}
            options={[...POLARITY_OPTIONS]}
            value={polarityFilter}
            onChange={(v: string) => setPolarityFilter(v as PolarityFilter)}
          />
        </div>
      </div>

      {/* Mod Count */}
      <div className="text-xs text-muted-foreground">
        {filteredMods.length} mod{filteredMods.length !== 1 ? "s" : ""}{" "}
        available
        {slotType !== "normal" && (
          <span className="ml-1 text-primary">
            ({slotType === "aura" ? "Aura" : "Exilus"} compatible)
          </span>
        )}
      </div>

      {/* Responsive Mod Grid - Horizontal scrolling with 2 rows */}
      <div
        ref={gridRef}
        className="grid gap-4 overflow-x-auto overflow-y-hidden py-4 px-2 max-w-full"
        style={{
          gridTemplateRows: "repeat(2, min-content)",
          gridAutoFlow: "column",
          gridAutoColumns: "200px",
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {filteredMods.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm w-[200px]">
            No mods found
          </div>
        ) : (
          filteredMods.map((mod, index) => (
            <SearchableModCard
              key={mod.uniqueName}
              mod={mod}
              isDisabled={isModUsed(mod)}
              isSelected={boundedSelectedIndex === index}
              onSelect={handleSelectMod}
              dataIndex={index}
            />
          ))
        )}
      </div>
    </div>
  );
}

// =============================================================================
// FILTER DROPDOWN COMPONENT
// =============================================================================

interface FilterDropdownProps {
  label: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}

function FilterDropdown({
  label,
  options,
  value,
  onChange,
}: FilterDropdownProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs bg-muted/50 border-border/50 hover:bg-muted gap-1"
        >
          {label}
          <svg
            className="w-3 h-3 opacity-50"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-32 p-1" align="start">
        {options.map((option) => (
          <button
            key={option}
            onClick={() => onChange(option)}
            className={cn(
              "w-full text-left px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors",
              value === option && "bg-muted font-medium"
            )}
          >
            {option}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
