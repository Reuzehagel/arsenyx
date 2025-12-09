"use client";

import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ItemGrid } from "./item-grid";
import { SearchBar } from "./search-bar";
import { CategoryTabs } from "./category-tabs";
import { FilterDropdown } from "./filter-dropdown";
import type { BrowseItem, BrowseCategory } from "@/lib/warframe/types";

interface BrowseContainerProps {
  initialItems: BrowseItem[];
  initialCategory: BrowseCategory;
  counts: Record<string, number>;
  initialQuery?: string;
}

export function BrowseContainer({
  initialItems,
  initialCategory,
  counts,
  initialQuery = "",
}: BrowseContainerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Local filter state for instant updates
  const [masteryMax, setMasteryMax] = useState(() => {
    const param = searchParams.get("mastery");
    return param ? parseInt(param, 10) : 30;
  });
  const [primeOnly, setPrimeOnly] = useState(
    () => searchParams.get("prime") === "true"
  );
  const [hideVaulted, setHideVaulted] = useState(
    () => searchParams.get("vaulted") === "hide"
  );
  const [searchQuery, setSearchQuery] = useState(initialQuery);
  const [pendingSearch, setPendingSearch] = useState(initialQuery);
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Filter items client-side for instant feedback
  const filteredItems = useMemo(() => {
    return initialItems.filter((item) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const nameMatch = item.name.toLowerCase().includes(query);
        const categoryMatch = item.category?.toLowerCase().includes(query);
        if (!nameMatch && !categoryMatch) return false;
      }

      // Mastery filter
      if (item.masteryReq !== undefined && item.masteryReq > masteryMax) {
        return false;
      }

      // Prime filter
      if (primeOnly && !item.isPrime) {
        return false;
      }

      // Vaulted filter
      if (hideVaulted && item.vaulted) {
        return false;
      }

      return true;
    });
  }, [initialItems, searchQuery, masteryMax, primeOnly, hideVaulted]);

  // Update URL params (debounced, doesn't block UI)
  const syncToUrl = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });
      // Use replace to avoid history spam, scroll: false to prevent jumping
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams]
  );

  const handleMasteryChange = useCallback(
    (value: number) => {
      setMasteryMax(value);
      // Only sync to URL on release or significant change
      syncToUrl({ mastery: value < 16 ? String(value) : null });
    },
    [syncToUrl]
  );

  const handlePrimeToggle = useCallback(() => {
    const newValue = !primeOnly;
    setPrimeOnly(newValue);
    syncToUrl({ prime: newValue ? "true" : null });
  }, [primeOnly, syncToUrl]);

  const handleVaultedToggle = useCallback(() => {
    const newValue = !hideVaulted;
    setHideVaulted(newValue);
    syncToUrl({ vaulted: newValue ? "hide" : null });
  }, [hideVaulted, syncToUrl]);

  const handleClearFilters = useCallback(() => {
    setMasteryMax(30);
    setPrimeOnly(false);
    setHideVaulted(false);
    syncToUrl({ mastery: null, prime: null, vaulted: null });
  }, [syncToUrl]);

  const handleSearchChange = useCallback((value: string) => {
    setSearchQuery(value);
    setPendingSearch(value);
  }, []);

  // Debounce syncing search query to the URL to avoid router churn
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current);
    }
    searchDebounceRef.current = setTimeout(() => {
      syncToUrl({ q: pendingSearch || null });
    }, 250);

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current);
      }
    };
  }, [pendingSearch, syncToUrl]);

  const activeFilterCount = [masteryMax < 30, primeOnly, hideVaulted].filter(
    Boolean
  ).length;

  return (
    <div className="space-y-6">
      {/* Search and Filters Row */}
      <div className="flex flex-col sm:flex-row gap-3">
        <SearchBar
          defaultValue={searchQuery}
          placeholder="Search items..."
          className="flex-1"
          onSearchChange={handleSearchChange}
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

      {/* Category Tabs */}
      <CategoryTabs activeCategory={initialCategory} counts={counts} />

      {/* Results info */}
      <div className="text-sm text-muted-foreground">
        {filteredItems.length} {filteredItems.length === 1 ? "item" : "items"}
        {searchQuery && ` matching "${searchQuery}"`}
      </div>

      {/* Item Grid */}
      <ItemGrid items={filteredItems} />
    </div>
  );
}
