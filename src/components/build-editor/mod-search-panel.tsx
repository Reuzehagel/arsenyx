"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import Image from "next/image";
import { getImageUrl } from "@/lib/warframe/images";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { PolarityIcon } from "@/components/icons";
import type { Mod, SlotType } from "@/lib/warframe/types";

interface ModSearchPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMod: (mod: Mod) => void;
  availableMods: Mod[];
  slotType: SlotType;
  usedModNames: string[];
}

// Rarity order for sorting
const RARITY_ORDER: Record<string, number> = {
  Legendary: 0,
  Rare: 1,
  Uncommon: 2,
  Common: 3,
  Peculiar: 4,
};

// Rarity colors - matching the Warframe mod card style
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

export function ModSearchPanel({
  onSelectMod,
  availableMods,
  slotType,
  usedModNames,
}: ModSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("Name");
  const [rarityFilter, setRarityFilter] = useState<RarityFilter>("All");
  const [polarityFilter, setPolarityFilter] = useState<PolarityFilter>("All");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Filter and sort mods
  const filteredMods = useMemo(() => {
    let mods = [...availableMods];

    // Filter by slot type
    if (slotType === "aura") {
      // Aura mods have compatName "AURA" (uppercase)
      mods = mods.filter((m) => m.compatName?.toUpperCase() === "AURA");
    } else if (slotType === "exilus") {
      mods = mods.filter((m) => m.isExilus);
    } else if (slotType === "normal") {
      // Exclude aura mods from normal slots
      mods = mods.filter((m) => m.compatName?.toUpperCase() !== "AURA");
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
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
    searchQuery,
    sortBy,
    rarityFilter,
    polarityFilter,
    slotType,
  ]);

  // Compute bounded selected index (auto-resets when filtered list shrinks)
  const boundedSelectedIndex = Math.min(
    selectedIndex,
    Math.max(0, filteredMods.length - 1)
  );

  // Scroll selected item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;

    const selectedItem = list.querySelector(
      `[data-index="${boundedSelectedIndex}"]`
    );
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: "nearest" });
    }
  }, [boundedSelectedIndex]);

  const handleSelectMod = useCallback(
    (mod: Mod) => {
      onSelectMod(mod);
    },
    [onSelectMod]
  );

  const isModUsed = useCallback(
    (mod: Mod) => {
      return usedModNames.includes(mod.name);
    },
    [usedModNames]
  );

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex((prev) =>
            Math.min(prev + 1, filteredMods.length - 1)
          );
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (
            filteredMods[boundedSelectedIndex] &&
            !isModUsed(filteredMods[boundedSelectedIndex])
          ) {
            handleSelectMod(filteredMods[boundedSelectedIndex]);
          }
          break;
      }
    },
    [filteredMods, boundedSelectedIndex, handleSelectMod, isModUsed]
  );

  return (
    <div className="flex flex-col h-full bg-card rounded-xl border overflow-hidden">
      {/* Search Header */}
      <div className="p-3 space-y-3 border-b">
        {/* Search Input */}
        <div className="relative">
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
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="pl-9 pr-16 bg-muted/50 border-0"
          />
          <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-muted-foreground">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">
              Ctrl
            </kbd>
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px]">S</kbd>
          </div>
        </div>

        {/* Filter Dropdowns */}
        <div className="flex gap-2">
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

      {/* Mod List */}
      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-2 space-y-1.5"
        onKeyDown={handleKeyDown}
      >
        {filteredMods.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm">
            No mods found
          </div>
        ) : (
          filteredMods.map((mod, index) => {
            const isUsed = isModUsed(mod);
            return (
              <ModCard
                key={mod.uniqueName}
                mod={mod}
                isSelected={boundedSelectedIndex === index}
                isUsed={isUsed}
                onClick={() => !isUsed && handleSelectMod(mod)}
                dataIndex={index}
              />
            );
          })
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
          className="h-8 text-xs bg-muted/50 border-0 hover:bg-muted gap-1"
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

// =============================================================================
// MOD CARD COMPONENT
// =============================================================================

interface ModCardProps {
  mod: Mod;
  isSelected: boolean;
  isUsed: boolean;
  onClick: () => void;
  dataIndex: number;
}

function ModCard({
  mod,
  isSelected,
  isUsed,
  onClick,
  dataIndex,
}: ModCardProps) {
  return (
    <div
      data-index={dataIndex}
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-all group",
        "border border-transparent bg-card hover:bg-accent/50 hover:border-border/50",
        isSelected && "ring-1 ring-primary bg-accent/50 border-primary/30",
        isUsed && "opacity-50 grayscale cursor-not-allowed"
      )}
    >
      {/* Mod Image */}
      <div className="relative w-10 h-10 rounded bg-black/20 flex-shrink-0 overflow-hidden border border-white/5">
        <Image
          src={getImageUrl(mod.imageName)}
          alt={mod.name}
          fill
          className="object-contain"
        />
      </div>

      {/* Mod Info */}
      <div className="flex-1 min-w-0 flex flex-col gap-0.5">
        <div className="flex items-center justify-between gap-2">
          <span
            className={cn(
              "font-medium text-sm truncate",
              isUsed && "line-through decoration-muted-foreground"
            )}
          >
            {mod.name}
          </span>
          {/* Drain & Polarity */}
          <div className="flex items-center gap-1 bg-muted/50 px-1.5 py-0.5 rounded text-[10px] font-mono text-muted-foreground">
            <span>{mod.baseDrain}</span>
            <PolarityIcon polarity={mod.polarity} size="xs" />
          </div>
        </div>

        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span
            className={cn(
              "uppercase tracking-wider font-medium",
              mod.rarity === "Legendary" && "text-amber-500",
              mod.rarity === "Rare" && "text-yellow-500",
              mod.rarity === "Uncommon" && "text-gray-400",
              mod.rarity === "Common" && "text-orange-700"
            )}
          >
            {mod.rarity}
          </span>
          <span>•</span>
          <span>Rank {mod.fusionLimit}</span>
        </div>
      </div>
    </div>
  );
}
