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
import { getModBaseName } from "@/lib/warframe/mod-variants";
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

// Search keyword aliases - maps user-friendly terms to what appears in mod stats
// Combined elements also include their component elements
const SEARCH_ALIASES: Record<string, string[]> = {
  // Abbreviations for ability stats
  dur: ["duration"],
  str: ["strength"],
  eff: ["efficiency"],
  rng: ["range"],
  crit: ["critical"],
  multi: ["multishot"],
  ms: ["multishot"],
  fr: ["fire rate"],
  sc: ["status chance"],
  cd: ["critical damage"],
  cc: ["critical chance"],
  as: ["attack speed"],
  hp: ["health"],
  // Combined elements -> base elements that create them
  viral: ["viral", "toxin", "cold"],
  vir: ["viral", "toxin", "cold"],
  corrosive: ["corrosive", "toxin", "electricity", "electric"],
  corr: ["corrosive", "toxin", "electricity", "electric"],
  radiation: ["radiation", "heat", "electricity", "electric"],
  rad: ["radiation", "heat", "electricity", "electric"],
  blast: ["blast", "heat", "cold"],
  gas: ["gas", "heat", "toxin"],
  magnetic: ["magnetic", "cold", "electricity", "electric"],
  mag: ["magnetic", "cold", "electricity", "electric"],
  // Base elements
  fire: ["heat"],
  electric: ["electricity"],
  elec: ["electricity", "electric"],
  poison: ["toxin"],
  tox: ["toxin"],
  cold: ["cold"],
  ice: ["cold"],
  heat: ["heat"],
  // Physical damage types
  ips: ["impact", "puncture", "slash"],
  punc: ["puncture"],
  imp: ["impact"],
  // Survivability
  armor: ["armor"],
  shield: ["shield"],
  energy: ["energy"],
  // Other common terms
  reload: ["reload"],
  ammo: ["ammo", "magazine"],
  punch: ["punch through"],
  dmg: ["damage"],
};

/**
 * Extracts searchable stat text from a mod's max rank stats.
 * Strips HTML-like color tags (e.g., <DT_VIRAL_COLOR>) from stat strings.
 */
function getModSearchableStats(mod: Mod): string {
  if (!mod.levelStats || mod.levelStats.length === 0) return "";
  // Get max rank stats (last entry)
  const maxRankStats = mod.levelStats[mod.levelStats.length - 1]?.stats ?? [];
  // Clean stat strings: strip <TAG> patterns and join
  return maxRankStats
    .map((s) => s.replace(/<[^>]+>/g, ""))
    .join(" ")
    .toLowerCase();
}

/**
 * Expands a search query using aliases.
 * Returns an array of terms to match against.
 * Only expands aliases when a word exactly matches (not substrings).
 */
function expandSearchQuery(query: string): string[] {
  const terms = [query];
  const queryWords = query.toLowerCase().split(/\s+/);

  for (const [alias, expansions] of Object.entries(SEARCH_ALIASES)) {
    // Only expand if a whole word matches the alias exactly
    if (queryWords.includes(alias)) {
      terms.push(...expansions);
    }
  }

  return [...new Set(terms)]; // Deduplicate
}

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
  const [sortBy, setSortBy] = useState<SortOption>("Drain");
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
    // Note: Aura mods are always shown in search results and auto-snap to the aura slot when clicked
    if (slotType === "aura") {
      mods = mods.filter((m) => m.compatName?.toUpperCase() === "AURA");
    } else if (slotType === "exilus") {
      // Both isExilus and isUtility indicate exilus-compatible mods in WFCD data
      mods = mods.filter((m) => m.isExilus || m.isUtility);
    }
    // Normal slot: show all mods including aura (they auto-snap to aura slot)

    // Filter by search query (with keyword aliases and stat matching)
    if (deferredSearchQuery.trim()) {
      const query = deferredSearchQuery.toLowerCase();
      const searchTerms = expandSearchQuery(query);

      mods = mods.filter((m) => {
        const name = m.name.toLowerCase();
        const description = m.description?.toLowerCase() ?? "";
        const stats = getModSearchableStats(m);
        const searchable = `${name} ${description} ${stats}`;

        return searchTerms.some((term) => searchable.includes(term));
      });
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
  // When list is empty, default to 0 so we're ready when results reappear
  const boundedSelectedIndex = filteredMods.length === 0
    ? 0
    : Math.min(selectedIndex, filteredMods.length - 1);

  // Check if a mod (or its variant) is already used
  const isModUsed = useCallback(
    (mod: Mod) => usedModNames.includes(getModBaseName(mod.name)),
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

  // Keyboard navigation for grid - only handle arrow keys when not focused on input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const grid = gridRef.current;
      if (!grid) return;

      const isInputFocused = e.target === inputRef.current;

      switch (e.key) {
        case "ArrowDown":
          // Allow natural input behavior when focused on input
          if (isInputFocused) return;
          e.preventDefault();
          // If in top row (even index), go to bottom row (index + 1)
          if (filteredMods.length > 0 && boundedSelectedIndex % 2 === 0) {
            const nextIndex = boundedSelectedIndex + 1;
            if (nextIndex < filteredMods.length) {
              setSelectedIndex(nextIndex);
            }
          }
          break;
        case "ArrowUp":
          // Allow natural input behavior when focused on input
          if (isInputFocused) return;
          e.preventDefault();
          // If in bottom row (odd index), go to top row (index - 1)
          if (boundedSelectedIndex % 2 !== 0) {
            setSelectedIndex(boundedSelectedIndex - 1);
          }
          break;
        case "ArrowRight":
          // Allow natural input behavior (caret movement, text selection)
          if (isInputFocused) return;
          e.preventDefault();
          // Go to next column (index + 2)
          if (filteredMods.length > 0) {
            setSelectedIndex((prev) =>
              Math.min(prev + 2, filteredMods.length - 1)
            );
          }
          break;
        case "ArrowLeft":
          // Allow natural input behavior (caret movement, text selection)
          if (isInputFocused) return;
          e.preventDefault();
          // Go to prev column (index - 2)
          setSelectedIndex((prev) => Math.max(prev - 2, 0));
          break;
        case "Enter":
          e.preventDefault();
          if (filteredMods.length > 0) {
            const selectedMod = filteredMods[boundedSelectedIndex];
            if (selectedMod && !isModUsed(selectedMod)) {
              // Use max rank by default when pressing Enter
              handleSelectMod(selectedMod, selectedMod.fusionLimit ?? 0);
            }
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

      {/* Responsive Mod Grid - Horizontal scrolling with responsive rows */}
      <div
        ref={gridRef}
        className="grid gap-x-2 sm:gap-x-4 gap-y-8 sm:gap-y-12 overflow-x-auto overflow-y-hidden pt-2 pb-8 px-2 max-w-full h-auto sm:h-72 content-center"
        style={{
          gridTemplateRows: "repeat(2, min-content)",
          gridAutoFlow: "column",
          gridAutoColumns: "160px",
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {filteredMods.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-muted-foreground text-sm w-[160px]">
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
