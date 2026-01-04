"use client";

import {
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useState,
  useDeferredValue,
} from "react";
import { useDraggable } from "@dnd-kit/core";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { ArcaneCard } from "@/components/arcane-card";
import type { Arcane } from "@/lib/warframe/types";

// =============================================================================
// CONSTANTS
// =============================================================================

const RARITY_ORDER: Record<string, number> = {
  Legendary: 0,
  Rare: 1,
  Uncommon: 2,
  Common: 3,
};

const RARITY_OPTIONS = [
  "All",
  "Legendary",
  "Rare",
  "Uncommon",
  "Common",
] as const;
const SORT_OPTIONS = ["Name", "Rarity"] as const;

type RarityFilter = (typeof RARITY_OPTIONS)[number];
type SortOption = (typeof SORT_OPTIONS)[number];

// =============================================================================
// ARCANE SEARCH PANEL COMPONENT
// =============================================================================

interface ArcaneSearchPanelProps {
  availableArcanes: Arcane[];
  usedArcaneNames: string[];
  onSelectArcane: (arcane: Arcane, rank: number) => void;
  className?: string;
}

export function ArcaneSearchPanel({
  availableArcanes,
  usedArcaneNames,
  onSelectArcane,
  className,
}: ArcaneSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("Name");
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("All");
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const deferredSearchQuery = useDeferredValue(searchQuery);

  // Filter and sort arcanes
  const filteredArcanes = useMemo(() => {
    let arcanes = [...availableArcanes];

    // Filter by search query
    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase();
      arcanes = arcanes.filter((a) => a.name.toLowerCase().includes(query));
    }

    // Filter by rarity
    if (rarityFilter !== "All") {
      arcanes = arcanes.filter((a) => a.rarity === rarityFilter);
    }

    // Sort
    switch (sortBy) {
      case "Name":
        arcanes.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "Rarity":
        arcanes.sort((a, b) => {
          const rarityDiff =
            (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99);
          if (rarityDiff !== 0) return rarityDiff;
          return a.name.localeCompare(b.name);
        });
        break;
    }

    return arcanes;
  }, [availableArcanes, deferredSearchQuery, sortBy, rarityFilter]);

  const boundedSelectedIndex =
    filteredArcanes.length === 0
      ? 0
      : Math.min(selectedIndex, filteredArcanes.length - 1);

  const isArcaneUsed = useCallback(
    (arcane: Arcane) => usedArcaneNames.includes(arcane.name),
    [usedArcaneNames]
  );

  const handleSelectArcane = useCallback(
    (arcane: Arcane, rank: number) => {
      if (!isArcaneUsed(arcane)) {
        onSelectArcane(arcane, rank);
      }
    },
    [isArcaneUsed, onSelectArcane]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const grid = gridRef.current;
      if (!grid) return;

      const isInputFocused = e.target === inputRef.current;

      // Select first item if nothing is selected
      if (
        selectedIndex === -1 &&
        ["ArrowDown", "ArrowUp", "ArrowRight", "ArrowLeft"].includes(e.key)
      ) {
        e.preventDefault();
        setSelectedIndex(0);
        return;
      }

      switch (e.key) {
        case "ArrowDown":
          if (isInputFocused) return;
          e.preventDefault();
          if (filteredArcanes.length > 0 && boundedSelectedIndex % 2 === 0) {
            const nextIndex = boundedSelectedIndex + 1;
            if (nextIndex < filteredArcanes.length) {
              setSelectedIndex(nextIndex);
            }
          }
          break;
        case "ArrowUp":
          if (isInputFocused) return;
          e.preventDefault();
          if (boundedSelectedIndex % 2 !== 0) {
            setSelectedIndex(boundedSelectedIndex - 1);
          }
          break;
        case "ArrowRight":
          if (isInputFocused) return;
          e.preventDefault();
          if (filteredArcanes.length > 0) {
            setSelectedIndex((prev) =>
              Math.min(prev + 2, filteredArcanes.length - 1)
            );
          }
          break;
        case "ArrowLeft":
          if (isInputFocused) return;
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 2, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredArcanes.length > 0 && selectedIndex !== -1) {
            const selectedArcane = filteredArcanes[boundedSelectedIndex];
            if (selectedArcane && !isArcaneUsed(selectedArcane)) {
              const maxRank = selectedArcane.levelStats
                ? selectedArcane.levelStats.length - 1
                : 5;
              handleSelectArcane(selectedArcane, maxRank);
            }
          }
          break;
      }
    },
    [
      filteredArcanes,
      boundedSelectedIndex,
      isArcaneUsed,
      handleSelectArcane,
      selectedIndex,
    ]
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
      {/* Search and Filter */}
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
            placeholder="Search arcanes..."
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
        </div>
      </div>

      {/* Arcane Grid - Horizontal scrolling with responsive rows */}
      <div
        ref={gridRef}
        className="grid gap-2 sm:gap-3 overflow-x-auto overflow-y-hidden pt-2 pb-8 px-2 max-w-full h-auto sm:h-72 content-center"
        style={{
          gridTemplateRows: "repeat(2, min-content)",
          gridAutoFlow: "column",
          gridAutoColumns: "100px",
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {filteredArcanes.length === 0 ? (
          <div className="flex items-center justify-center h-24 text-muted-foreground text-sm w-[110px]">
            No arcanes found
          </div>
        ) : (
          filteredArcanes.map((arcane, index) => (
            <SearchableArcaneCard
              key={arcane.uniqueName}
              arcane={arcane}
              isDisabled={isArcaneUsed(arcane)}
              isSelected={boundedSelectedIndex === index}
              onSelect={handleSelectArcane}
              dataIndex={index}
            />
          ))
        )}
      </div>
    </div>
  );
}

// =============================================================================
// SEARCHABLE ARCANE CARD COMPONENT
// =============================================================================

interface SearchableArcaneCardProps {
  arcane: Arcane;
  isDisabled?: boolean;
  isSelected?: boolean;
  onSelect: (arcane: Arcane, rank: number) => void;
  dataIndex?: number;
}

function SearchableArcaneCard({
  arcane,
  isDisabled = false,
  isSelected = false,
  onSelect,
  dataIndex,
}: SearchableArcaneCardProps) {
  const maxRank = arcane.levelStats ? arcane.levelStats.length - 1 : 5;

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `search-arcane-${arcane.uniqueName}`,
    data: { arcane, rank: maxRank, type: "search-arcane" },
    disabled: isDisabled,
  });

  const style = {
    // Hide the original element when dragging - DragOverlay shows the ghost
    opacity: isDragging ? 0 : 1,
  };

  const handleClick = useCallback(() => {
    if (!isDisabled) {
      onSelect(arcane, maxRank);
    }
  }, [isDisabled, arcane, maxRank, onSelect]);

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      data-index={dataIndex}
      className={cn(
        "relative flex flex-col items-center cursor-pointer transition-all rounded-lg p-2 group touch-none select-none",
        "bg-card/30 border border-transparent",
        isDisabled && "opacity-40 grayscale cursor-not-allowed"
      )}
      onClick={handleClick}
    >
      <ArcaneCard
        arcane={arcane}
        rank={maxRank}
        isSelected={isSelected}
        disableHover={isDragging}
      />
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
