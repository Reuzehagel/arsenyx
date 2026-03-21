"use client";

import { useMemo, useCallback } from "react";
import { Search } from "lucide-react";
import { useDraggable } from "@dnd-kit/core";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { ArcaneCard } from "@/components/arcane-card/arcane-card";
import { FilterDropdown } from "./filter-dropdown";
import {
  useSearchPanel,
  useScrollIntoView,
  computeBoundedIndex,
  handleGridKeyDown,
  RARITY_ORDER,
  RARITY_OPTIONS,
} from "./hooks/use-search-panel";
import type { Arcane } from "@/lib/warframe/types";

// =============================================================================
// ARCANE-SPECIFIC CONSTANTS
// =============================================================================

const SORT_OPTIONS = ["Name", "Rarity"] as const;

type SortOption = (typeof SORT_OPTIONS)[number];

// =============================================================================
// COMPONENT
// =============================================================================

interface ArcaneSearchPanelProps {
  availableArcanes: Arcane[];
  usedArcaneNames: Set<string>;
  onSelectArcane: (arcane: Arcane, rank: number) => void;
  className?: string;
}

export function ArcaneSearchPanel({
  availableArcanes,
  usedArcaneNames,
  onSelectArcane,
  className,
}: ArcaneSearchPanelProps) {
  const {
    searchQuery, setSearchQuery, deferredSearchQuery,
    rarityFilter, setRarityFilter, sortBy, setSortBy,
    selectedIndex, setSelectedIndex, inputRef, gridRef,
  } = useSearchPanel({
    initialSelectedIndex: -1,
    defaultSort: "Name",
  });

  // Filter and sort arcanes
  const filteredArcanes = useMemo(() => {
    let arcanes = [...availableArcanes];

    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase();
      arcanes = arcanes.filter((a) => a.name.toLowerCase().includes(query));
    }

    if (rarityFilter !== "All") {
      arcanes = arcanes.filter((a) => a.rarity === rarityFilter);
    }

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

  const boundedSelectedIndex = computeBoundedIndex(selectedIndex, filteredArcanes.length);

  useScrollIntoView(gridRef, boundedSelectedIndex);

  const isArcaneUsed = useCallback(
    (arcane: Arcane) => usedArcaneNames.has(arcane.name),
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

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      handleGridKeyDown(e, {
        gridRef,
        inputRef,
        itemCount: filteredArcanes.length,
        boundedSelectedIndex,
        selectedIndex,
        setSelectedIndex,
        onEnterSelect: (index) => {
          const selectedArcane = filteredArcanes[index];
          if (selectedArcane && !isArcaneUsed(selectedArcane)) {
            const maxRank = selectedArcane.levelStats
              ? selectedArcane.levelStats.length - 1
              : 5;
            handleSelectArcane(selectedArcane, maxRank);
          }
        },
      });
    },
    [filteredArcanes, boundedSelectedIndex, selectedIndex, setSelectedIndex, gridRef, inputRef, isArcaneUsed, handleSelectArcane]
  );

  return (
    <div className={cn("flex flex-col gap-4", className)}>
      {/* Search and Filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search arcanes..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9 bg-muted/50 border-border/50"
          />
        </div>

        <div className="flex gap-2 flex-wrap">
          <FilterDropdown
            label={sortBy}
            options={[...SORT_OPTIONS]}
            value={sortBy}
            onChange={(v) => setSortBy(v as SortOption)}
          />
          <FilterDropdown
            label={rarityFilter === "All" ? "Rarity" : rarityFilter}
            options={[...RARITY_OPTIONS]}
            value={rarityFilter}
            onChange={(v) => setRarityFilter(v as (typeof RARITY_OPTIONS)[number])}
          />
        </div>
      </div>

      {/* Arcane Grid */}
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
// SEARCHABLE ARCANE CARD (arcane-specific — includes drag support)
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

  const handleClick = useCallback(() => {
    if (!isDisabled) {
      onSelect(arcane, maxRank);
    }
  }, [isDisabled, arcane, maxRank, onSelect]);

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      data-index={dataIndex}
      className={cn(
        "search-grid-item relative flex flex-col items-center cursor-pointer transition-all rounded-lg p-2 group touch-none select-none",
        "bg-card/30 border border-transparent",
        isDisabled && "opacity-40 grayscale cursor-not-allowed",
        isDragging && "opacity-0"
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
