import { Search, X } from "lucide-react";
import { useDeferredValue, useMemo, useState } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Mod } from "@arsenyx/shared/warframe/types";

import { ModCard } from "./mod-card";

const SORT_OPTIONS = ["Drain", "Name", "Rarity"] as const;
const RARITY_OPTIONS = [
  "All",
  "Common",
  "Uncommon",
  "Rare",
  "Legendary",
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

type SortOption = (typeof SORT_OPTIONS)[number];
type RarityFilter = (typeof RARITY_OPTIONS)[number];
type PolarityFilter = (typeof POLARITY_OPTIONS)[number];

const RARITY_ORDER: Record<string, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Legendary: 3,
};

const HTML_TAG_PATTERN = /<[^>]+>/g;

function getSearchable(mod: Mod): string {
  const name = mod.name.toLowerCase();
  const desc = mod.description?.toLowerCase() ?? "";
  const stats =
    mod.levelStats?.[mod.levelStats.length - 1]?.stats
      ?.map((s) => s.replace(HTML_TAG_PATTERN, ""))
      .join(" ")
      .toLowerCase() ?? "";
  return `${name} ${desc} ${stats}`;
}

interface ModSearchGridProps {
  mods: Mod[];
}

export function ModSearchGrid({ mods }: ModSearchGridProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [sort, setSort] = useState<SortOption>("Drain");
  const [rarity, setRarity] = useState<RarityFilter>("All");
  const [polarity, setPolarity] = useState<PolarityFilter>("All");

  // Stable ordering: computed from `mods` + `sort` only. Filters dim instead
  // of remove, so positions don't shift when search/rarity/polarity narrow
  // the view — mirrors how the in-game arsenal keeps mods in place.
  const ordered = useMemo(() => {
    const copy = [...mods];
    switch (sort) {
      case "Name":
        copy.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "Drain":
        copy.sort(
          (a, b) =>
            (b.baseDrain ?? 0) - (a.baseDrain ?? 0) ||
            a.name.localeCompare(b.name),
        );
        break;
      case "Rarity":
        copy.sort(
          (a, b) =>
            (RARITY_ORDER[a.rarity] ?? 99) - (RARITY_ORDER[b.rarity] ?? 99) ||
            a.name.localeCompare(b.name),
        );
        break;
    }
    return copy;
  }, [mods, sort]);

  const searchIndex = useMemo(() => {
    const map = new Map<string, string>();
    for (const m of mods) map.set(m.uniqueName, getSearchable(m));
    return map;
  }, [mods]);

  const matches = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const hasQuery = q.length > 0;
    const hasRarity = rarity !== "All";
    const hasPolarity = polarity !== "All";
    const pLower = polarity.toLowerCase();

    const set = new Set<string>();
    for (const m of ordered) {
      if (hasRarity && m.rarity !== rarity) continue;
      if (hasPolarity && m.polarity.toLowerCase() !== pLower) continue;
      if (hasQuery) {
        const text = searchIndex.get(m.uniqueName) ?? "";
        if (!text.includes(q)) continue;
      }
      set.add(m.uniqueName);
    }
    return set;
  }, [ordered, deferredQuery, rarity, polarity, searchIndex]);

  const matchCount = matches.size;

  // When searching, float matches to the front so they're visible without
  // horizontal scrolling. Non-matches keep their relative sort order behind
  // them (and stay rendered, just dimmed).
  const displayed = useMemo(() => {
    if (deferredQuery.trim().length === 0) return ordered;
    const hits: Mod[] = [];
    const rest: Mod[] = [];
    for (const m of ordered) {
      if (matches.has(m.uniqueName)) hits.push(m);
      else rest.push(m);
    }
    return [...hits, ...rest];
  }, [ordered, matches, deferredQuery]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold">Compatible Mods</h2>
        <span className="text-muted-foreground text-sm">
          {matchCount} / {mods.length}
        </span>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            placeholder="Search mods…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.length > 0 && (
            <InputGroupAddon align="inline-end">
              <InputGroupButton
                size="icon-xs"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          )}
        </InputGroup>

        <div className="flex gap-2">
          <Select value={sort} onValueChange={(v) => setSort(v as SortOption)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={rarity}
            onValueChange={(v) => setRarity(v as RarityFilter)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {RARITY_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={polarity}
            onValueChange={(v) => setPolarity(v as PolarityFilter)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {POLARITY_OPTIONS.map((o) => (
                <SelectItem key={o} value={o}>
                  {o}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 2-row horizontal scroll grid. grid-auto-flow: column with
          grid-template-rows: repeat(2, …) fills top→bottom before moving
          right. Positions are stable under filters: non-matching cards dim
          but stay in place, so the eye doesn't lose its spot. */}
      <div
        className="grid max-w-full content-start gap-x-2 gap-y-4 overflow-x-auto px-1 pt-2 pb-6"
        style={{
          gridTemplateRows: "repeat(2, min-content)",
          gridAutoFlow: "column",
          gridAutoColumns: "200px",
          justifyContent: "start",
        }}
      >
        {displayed.map((mod) => {
          const isMatch = matches.has(mod.uniqueName);
          return (
            <div
              key={mod.uniqueName}
              className={cn(
                "transition-opacity duration-150",
                !isMatch &&
                  "pointer-events-none opacity-20 saturate-0",
              )}
            >
              <ModCard mod={mod} />
            </div>
          );
        })}
      </div>
    </div>
  );
}
