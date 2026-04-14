"use client"

import { useRouter, useSearchParams } from "next/navigation"
import { useState, useMemo, useCallback, useEffect, useRef, useDeferredValue } from "react"

import { sortItems } from "@/lib/warframe/items"
import type {
  BrowseItem,
  BrowseCategory,
  SortOption,
} from "@/lib/warframe/types"

import { CategoryTabs } from "./category-tabs"
import { FilterDropdown } from "./filter-dropdown"
import { ItemGrid } from "./item-grid"
import { SearchBar } from "./search-bar"
import { SortDropdown } from "./sort-dropdown"

interface BrowseContainerProps {
  initialItems: BrowseItem[]
  initialCategory: BrowseCategory
  initialQuery?: string
}

export function BrowseContainer({
  initialItems,
  initialCategory,
  initialQuery = "",
}: BrowseContainerProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const searchParamsString = searchParams.toString()

  // Local filter state for instant updates
  const [masteryMax, setMasteryMax] = useState(() => {
    const param = searchParams.get("mastery")
    return param ? parseInt(param, 10) : 30
  })
  const [primeOnly, setPrimeOnly] = useState(
    () => searchParams.get("prime") === "true",
  )
  const [hideVaulted, setHideVaulted] = useState(
    () => searchParams.get("vaulted") === "hide",
  )
  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [pendingSearch, setPendingSearch] = useState(initialQuery)
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [sortOption, setSortOption] = useState<SortOption>(() => {
    const param = searchParams.get("sort")
    const validOptions: SortOption[] = [
      "name-asc",
      "name-desc",
      "date-desc",
      "date-asc",
    ]
    return validOptions.includes(param as SortOption)
      ? (param as SortOption)
      : "name-asc"
  })

  const deferredSearchQuery = useDeferredValue(searchQuery)

  // Filter and sort items client-side for instant feedback
  const filteredAndSortedItems = useMemo(() => {
    // First filter
    const result = initialItems.filter((item) => {
      // Search filter
      if (deferredSearchQuery) {
        const query = deferredSearchQuery.toLowerCase()
        const nameMatch = item.name.toLowerCase().includes(query)
        const categoryMatch = item.category?.toLowerCase().includes(query)
        if (!nameMatch && !categoryMatch) return false
      }

      // Mastery filter
      if (item.masteryReq !== undefined && item.masteryReq > masteryMax) {
        return false
      }

      // Prime filter
      if (primeOnly && !item.isPrime) {
        return false
      }

      // Vaulted filter
      if (hideVaulted && item.vaulted) {
        return false
      }

      return true
    })

    // Then sort
    return sortItems(result, sortOption)
  }, [
    initialItems,
    deferredSearchQuery,
    masteryMax,
    primeOnly,
    hideVaulted,
    sortOption,
  ])

  // Update URL params (debounced, doesn't block UI)
  const syncToUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParamsString)
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "") {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      })
      const next = params.toString()
      if (next === searchParamsString) return
      // Use replace to avoid history spam, scroll: false to prevent jumping
      router.replace(`?${next}`, { scroll: false })
    },
    [router, searchParamsString],
  )

  const handleMasteryChange = useCallback(
    (value: number) => {
      setMasteryMax(value)
      // Only sync to URL on release or significant change
      syncToUrl({ mastery: value < 16 ? String(value) : null })
    },
    [syncToUrl],
  )

  const primeOnlyRef = useRef(primeOnly)
  primeOnlyRef.current = primeOnly
  const hideVaultedRef = useRef(hideVaulted)
  hideVaultedRef.current = hideVaulted

  const handlePrimeToggle = useCallback(() => {
    const newValue = !primeOnlyRef.current
    setPrimeOnly(newValue)
    syncToUrl({ prime: newValue ? "true" : null })
  }, [syncToUrl])

  const handleVaultedToggle = useCallback(() => {
    const newValue = !hideVaultedRef.current
    setHideVaulted(newValue)
    syncToUrl({ vaulted: newValue ? "hide" : null })
  }, [syncToUrl])

  const handleSortChange = useCallback(
    (value: SortOption) => {
      setSortOption(value)
      syncToUrl({ sort: value === "name-asc" ? null : value })
    },
    [syncToUrl],
  )

  const handleClearFilters = useCallback(() => {
    setMasteryMax(30)
    setPrimeOnly(false)
    setHideVaulted(false)
    setSortOption("name-asc")
    syncToUrl({ mastery: null, prime: null, vaulted: null, sort: null })
  }, [syncToUrl])

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value)
    setPendingSearch(value)
  }, [])

  // Debounce syncing search query to the URL to avoid router churn
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }
    searchDebounceRef.current = setTimeout(() => {
      syncToUrl({ q: pendingSearch || null })
    }, 250)

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
    }
  }, [pendingSearch, syncToUrl])

  const activeFilterCount = [masteryMax < 30, primeOnly, hideVaulted].filter(
    Boolean,
  ).length

  return (
    <div className="flex flex-col gap-6">
      {/* Search and Filters Row */}
      <div className="flex flex-col gap-3 sm:flex-row">
        <SearchBar
          defaultValue={searchQuery}
          placeholder="Search items…"
          className="flex-1"
          onSearchChange={handleSearchChange}
        />
        <div className="flex gap-3">
          <SortDropdown
            sortOption={sortOption}
            onSortChange={handleSortChange}
          />
          <FilterDropdown
            masteryMax={masteryMax}
            primeOnly={primeOnly}
            hideVaulted={hideVaulted}
            activeFilterCount={activeFilterCount}
            onMasteryChange={handleMasteryChange}
            onPrimeToggle={handlePrimeToggle}
            onVaultedToggle={handleVaultedToggle}
            onClearFilters={handleClearFilters}
          />
        </div>
      </div>

      {/* Category Tabs */}
      <CategoryTabs activeCategory={initialCategory} />

      {/* Results info */}
      <div className="text-muted-foreground text-sm">
        {filteredAndSortedItems.length}{" "}
        {filteredAndSortedItems.length === 1 ? "item" : "items"}
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Item Grid */}
      <ItemGrid items={filteredAndSortedItems} />
    </div>
  )
}
