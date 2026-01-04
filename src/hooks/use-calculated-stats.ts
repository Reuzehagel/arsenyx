"use client";

import { useMemo, useState } from "react";
import { calculateStats, buildHasConditionalMods } from "@/lib/warframe/stats-calculator";
import type { BrowseableItem, BuildState } from "@/lib/warframe/types";
import type { CalculatedStats } from "@/lib/warframe/stat-types";

interface UseCalculatedStatsOptions {
  item: BrowseableItem;
  buildState: BuildState;
}

interface UseCalculatedStatsReturn {
  stats: CalculatedStats;
  showMaxStacks: boolean;
  setShowMaxStacks: (value: boolean) => void;
  hasConditionalMods: boolean;
}

/**
 * React hook for calculating real-time build stats
 *
 * Uses useMemo for efficient recalculation only when build state changes.
 * Provides toggle for showing conditional mods at max stacks.
 */
export function useCalculatedStats({
  item,
  buildState,
}: UseCalculatedStatsOptions): UseCalculatedStatsReturn {
  const [showMaxStacks, setShowMaxStacks] = useState(false);

  const stats = useMemo(
    () => calculateStats(item, buildState, showMaxStacks),
    [item, buildState, showMaxStacks]
  );

  const hasConditionalMods = useMemo(
    () => buildHasConditionalMods(buildState),
    [buildState]
  );

  return {
    stats,
    showMaxStacks,
    setShowMaxStacks,
    hasConditionalMods,
  };
}
