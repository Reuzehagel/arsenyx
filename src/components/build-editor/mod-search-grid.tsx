"use client";

import { useMemo, useCallback, useState } from "react";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { SearchableModCard } from "./searchable-mod-card";
import { FilterDropdown } from "./filter-dropdown";
import { getModBaseName } from "@/lib/warframe/mod-variants";
import {
  useSearchPanel,
  useScrollIntoView,
  computeBoundedIndex,
  handleGridKeyDown,
  RARITY_ORDER,
  RARITY_OPTIONS,
} from "./hooks/use-search-panel";
import type { Mod, SlotType } from "@/lib/warframe/types";

// =============================================================================
// MOD-SPECIFIC CONSTANTS & HELPERS
// =============================================================================

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

type PolarityFilter = (typeof POLARITY_OPTIONS)[number];
type SortOption = (typeof SORT_OPTIONS)[number];

const SEARCH_ALIASES: Record<string, string[]> = {
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
  fire: ["heat"],
  electric: ["electricity"],
  elec: ["electricity", "electric"],
  poison: ["toxin"],
  tox: ["toxin"],
  cold: ["cold"],
  ice: ["cold"],
  heat: ["heat"],
  ips: ["impact", "puncture", "slash"],
  punc: ["puncture"],
  imp: ["impact"],
  armor: ["armor"],
  shield: ["shield"],
  energy: ["energy"],
  reload: ["reload"],
  ammo: ["ammo", "magazine"],
  punch: ["punch through"],
  dmg: ["damage"],
};

function getModSearchableStats(mod: Mod): string {
  if (!mod.levelStats || mod.levelStats.length === 0) return "";
  const maxRankStats = mod.levelStats[mod.levelStats.length - 1]?.stats ?? [];
  return maxRankStats
    .map((s) => s.replace(/<[^>]+>/g, ""))
    .join(" ")
    .toLowerCase();
}

function expandSearchQuery(query: string): string[] {
  const terms = [query];
  const queryWords = query.toLowerCase().split(/\s+/);
  for (const [alias, expansions] of Object.entries(SEARCH_ALIASES)) {
    if (queryWords.includes(alias)) {
      terms.push(...expansions);
    }
  }
  return [...new Set(terms)];
}

// =============================================================================
// COMPONENT
// =============================================================================

interface ModSearchGridProps {
  availableMods: Mod[];
  slotType: SlotType;
  usedModNames: Set<string>;
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
  const [polarityFilter, setPolarityFilter] = useState<PolarityFilter>("All");

  const {
    searchQuery, setSearchQuery, deferredSearchQuery,
    rarityFilter, setRarityFilter, sortBy, setSortBy,
    selectedIndex, setSelectedIndex, inputRef, gridRef,
  } = useSearchPanel({ defaultSort: "Drain" });

  // Filter and sort mods
  const filteredMods = useMemo(() => {
    let mods = [...availableMods];

    if (slotType === "aura") {
      mods = mods.filter((m) => m.compatName?.toUpperCase() === "AURA");
    } else if (slotType === "exilus") {
      mods = mods.filter((m) => m.isExilus || m.isUtility);
    }

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

    if (rarityFilter !== "All") {
      mods = mods.filter((m) => m.rarity === rarityFilter);
    }

    if (polarityFilter !== "All") {
      mods = mods.filter(
        (m) => m.polarity.toLowerCase() === polarityFilter.toLowerCase()
      );
    }

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
  }, [availableMods, deferredSearchQuery, sortBy, rarityFilter, polarityFilter, slotType]);

  const boundedSelectedIndex = computeBoundedIndex(selectedIndex, filteredMods.length);

  useScrollIntoView(gridRef, boundedSelectedIndex);

  const isModUsed = useCallback(
    (mod: Mod) => usedModNames.has(getModBaseName(mod.name)),
    [usedModNames]
  );

  const handleSelectMod = useCallback(
    (mod: Mod, rank: number) => {
      if (!isModUsed(mod)) {
        onSelectMod(mod, rank);
      }
    },
    [isModUsed, onSelectMod]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      handleGridKeyDown(e, {
        gridRef,
        inputRef,
        itemCount: filteredMods.length,
        boundedSelectedIndex,
        selectedIndex,
        setSelectedIndex,
        onEnterSelect: (index) => {
          const selectedMod = filteredMods[index];
          if (selectedMod && !isModUsed(selectedMod)) {
            handleSelectMod(selectedMod, selectedMod.fusionLimit ?? 0);
          }
        },
      });
    },
    [filteredMods, boundedSelectedIndex, selectedIndex, setSelectedIndex, gridRef, inputRef, isModUsed, handleSelectMod]
  );

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Search and Filter Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            placeholder="Search mods..."
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
          <FilterDropdown
            label={polarityFilter === "All" ? "Polarity" : polarityFilter}
            options={[...POLARITY_OPTIONS]}
            value={polarityFilter}
            onChange={(v) => setPolarityFilter(v as PolarityFilter)}
          />
        </div>
      </div>

      {/* Mod Grid */}
      <div
        ref={gridRef}
        className="grid gap-x-2 gap-y-4 overflow-x-auto pt-2 pb-6 px-2 max-w-full content-start"
        style={{
          gridTemplateRows: "repeat(2, min-content)",
          gridAutoFlow: "column",
          gridAutoColumns: "200px",
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
