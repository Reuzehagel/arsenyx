"use client"

import { Search } from "lucide-react"
import { useMemo, useCallback, useState } from "react"

import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { getModBaseName } from "@/lib/warframe/mod-variants"
import {
  RIVEN_ELIGIBLE_CATEGORIES,
  createSyntheticRiven,
  isRivenMod,
} from "@/lib/warframe/rivens"
import type { Mod, SlotType, BrowseCategory } from "@/lib/warframe/types"

import { FilterDropdown } from "./filter-dropdown"
import {
  useSearchPanel,
  useScrollIntoView,
  computeBoundedIndex,
  handleGridKeyDown,
  RARITY_ORDER,
  RARITY_OPTIONS,
} from "./hooks/use-search-panel"
import { SearchableModCard } from "./searchable-mod-card"

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
] as const
const SORT_OPTIONS = ["Name", "Drain", "Rarity"] as const

type PolarityFilter = (typeof POLARITY_OPTIONS)[number]
type SortOption = (typeof SORT_OPTIONS)[number]

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
}

const HTML_TAG_PATTERN = /<[^>]+>/g

function getModSearchableStats(mod: Mod): string {
  if (!mod.levelStats || mod.levelStats.length === 0) return ""
  const maxRankStats = mod.levelStats[mod.levelStats.length - 1]?.stats ?? []
  return maxRankStats
    .map((s) => s.replace(HTML_TAG_PATTERN, ""))
    .join(" ")
    .toLowerCase()
}

function expandSearchQuery(query: string): string[] {
  const terms = [query]
  const queryWords = query.toLowerCase().split(/\s+/)
  for (const [alias, expansions] of Object.entries(SEARCH_ALIASES)) {
    if (queryWords.includes(alias)) {
      terms.push(...expansions)
    }
  }
  return [...new Set(terms)]
}

// =============================================================================
// COMPONENT
// =============================================================================

interface ModSearchGridProps {
  availableMods: Mod[]
  slotType: SlotType
  usedModNames: Set<string>
  onSelectMod: (mod: Mod, rank: number) => void
  itemCategory: BrowseCategory
  className?: string
}

export function ModSearchGrid({
  availableMods,
  slotType,
  usedModNames,
  onSelectMod,
  itemCategory,
  className,
}: ModSearchGridProps) {
  const [polarityFilter, setPolarityFilter] = useState<PolarityFilter>("All")

  const {
    searchQuery,
    setSearchQuery,
    deferredSearchQuery,
    rarityFilter,
    setRarityFilter,
    sortBy,
    setSortBy,
    selectedIndex,
    setSelectedIndex,
    inputRef,
    gridRef,
  } = useSearchPanel({ defaultSort: "Drain" })

  // Precompute searchable strings once per mod list change
  const searchIndex = useMemo(() => {
    const index = new Map<string, string>()
    for (const m of availableMods) {
      const name = m.name.toLowerCase()
      const description = m.description?.toLowerCase() ?? ""
      const stats = getModSearchableStats(m)
      index.set(m.uniqueName, `${name} ${description} ${stats}`)
    }
    return index
  }, [availableMods])

  // Filter and sort mods
  const filteredMods = useMemo(() => {
    const hasSearch = deferredSearchQuery.trim().length > 0
    const searchTerms = hasSearch
      ? expandSearchQuery(deferredSearchQuery.toLowerCase())
      : []
    const hasRarityFilter = rarityFilter !== "All"
    const hasPolarityFilter = polarityFilter !== "All"
    const polarityLower = polarityFilter.toLowerCase()

    const mods = availableMods.filter((m) => {
      if (slotType === "aura") {
        if (m.compatName?.toUpperCase() !== "AURA") return false
      } else if (slotType === "exilus") {
        if (!m.isExilus && !m.isUtility) return false
      }
      if (hasSearch) {
        const searchable = searchIndex.get(m.uniqueName) ?? ""
        if (!searchTerms.some((term) => searchable.includes(term))) return false
      }
      if (hasRarityFilter && m.rarity !== rarityFilter) return false
      if (hasPolarityFilter && m.polarity.toLowerCase() !== polarityLower)
        return false
      return true
    })

    switch (sortBy) {
      case "Name":
        mods.sort((a, b) => a.name.localeCompare(b.name))
        break
      case "Drain":
        mods.sort((a, b) => b.baseDrain - a.baseDrain)
        break
      case "Rarity":
        mods.sort((a, b) => {
          const rarityDiff =
            (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99)
          if (rarityDiff !== 0) return rarityDiff
          return a.name.localeCompare(b.name)
        })
        break
    }

    return mods
  }, [
    availableMods,
    deferredSearchQuery,
    sortBy,
    rarityFilter,
    polarityFilter,
    slotType,
    searchIndex,
  ])

  const modsWithRiven = useMemo(() => {
    if (slotType === "normal" && RIVEN_ELIGIBLE_CATEGORIES.has(itemCategory)) {
      return [createSyntheticRiven(), ...filteredMods]
    }
    return filteredMods
  }, [filteredMods, slotType, itemCategory])

  const boundedSelectedIndex = computeBoundedIndex(
    selectedIndex,
    modsWithRiven.length,
  )

  useScrollIntoView(gridRef, boundedSelectedIndex)

  const isModUsed = useCallback(
    (mod: Mod) => {
      if (isRivenMod(mod)) return usedModNames.has("Riven Mod")
      return usedModNames.has(getModBaseName(mod.name))
    },
    [usedModNames],
  )

  const handleSelectMod = useCallback(
    (mod: Mod, rank: number) => {
      if (!isModUsed(mod)) {
        onSelectMod(mod, rank)
      }
    },
    [isModUsed, onSelectMod],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      handleGridKeyDown(e, {
        gridRef,
        inputRef,
        itemCount: modsWithRiven.length,
        boundedSelectedIndex,
        selectedIndex,
        setSelectedIndex,
        onEnterSelect: (index) => {
          const selectedMod = modsWithRiven[index]
          if (selectedMod && !isModUsed(selectedMod)) {
            handleSelectMod(selectedMod, selectedMod.fusionLimit ?? 0)
          }
        },
      })
    },
    [
      modsWithRiven,
      boundedSelectedIndex,
      selectedIndex,
      setSelectedIndex,
      gridRef,
      inputRef,
      isModUsed,
      handleSelectMod,
    ],
  )

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Search and Filter Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            ref={inputRef}
            placeholder="Search mods…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="bg-muted/50 border-border/50 pl-9"
          />
        </div>

        <div className="flex flex-wrap gap-2">
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
            onChange={(v) =>
              setRarityFilter(v as (typeof RARITY_OPTIONS)[number])
            }
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
        className="grid max-w-full content-start gap-x-2 gap-y-4 overflow-x-auto px-2 pt-2 pb-6"
        style={{
          gridTemplateRows: "repeat(2, min-content)",
          gridAutoFlow: "column",
          gridAutoColumns: "200px",
        }}
        onKeyDown={handleKeyDown}
        tabIndex={0}
      >
        {modsWithRiven.length === 0 ? (
          <div className="text-muted-foreground flex h-32 w-[160px] items-center justify-center text-sm">
            No mods found
          </div>
        ) : (
          modsWithRiven.map((mod, index) => (
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
  )
}
