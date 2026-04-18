import { Search, X } from "lucide-react";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { Mod, Polarity } from "@arsenyx/shared/warframe/types";

import { ModCard } from "./mod-card";
import type { ModSlotKind } from "./mod-slot";
import { isAuraMod, isExilusCompatible } from "./use-build-slots";

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
  "madurai",
  "vazarin",
  "naramon",
  "zenurik",
  "unairu",
  "penjaga",
  "umbra",
] as const satisfies readonly ("All" | Polarity)[];

type SortOption = (typeof SORT_OPTIONS)[number];
type RarityFilter = (typeof RARITY_OPTIONS)[number];
type PolarityFilter = (typeof POLARITY_OPTIONS)[number];

const RARITY_ORDER: Record<Exclude<RarityFilter, "All">, number> = {
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

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface FilterSelectProps<T extends string> {
  value: T;
  onChange: (v: T) => void;
  options: readonly T[];
  labelFor?: (v: T) => string;
}

function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  labelFor,
}: FilterSelectProps<T>) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {labelFor ? labelFor(o) : o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

interface ModSearchGridProps {
  mods: Mod[];
  usedModNames?: Set<string>;
  onSelect?: (mod: Mod) => void;
  /**
   * When set, mods incompatible with this slot kind are dimmed (aura-only for
   * the aura slot, exilus/utility-only for exilus). `"normal"` or undefined
   * disables the kind filter.
   */
  selectedSlotKind?: ModSlotKind;
}

function slotKindPredicate(kind: ModSlotKind | undefined) {
  if (!kind || kind === "normal") return null;
  if (kind === "aura") return (m: Mod) => isAuraMod(m);
  return (m: Mod) => !isAuraMod(m) && isExilusCompatible(m);
}

export function ModSearchGrid({
  mods,
  usedModNames,
  onSelect,
  selectedSlotKind,
}: ModSearchGridProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [sort, setSort] = useState<SortOption>("Drain");
  const [rarity, setRarity] = useState<RarityFilter>("All");
  const [polarity, setPolarity] = useState<PolarityFilter>("All");
  const searchRef = useRef<HTMLInputElement>(null);

  // `/` focuses the search from anywhere on the page, mirroring the browse page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return;
      const t = e.target as HTMLElement | null;
      if (
        t?.tagName === "INPUT" ||
        t?.tagName === "TEXTAREA" ||
        t?.isContentEditable
      ) {
        return;
      }
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Stable ordering: computed from `mods` + `sort` only. Filters dim instead
  // of remove, so positions don't shift when search/rarity/polarity narrow
  // the view — mirrors how the in-game arsenal keeps mods in place.
  const ordered = useMemo(() => {
    const copy = [...mods];
    switch (sort) {
      case "Name":
        copy.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case "Drain": {
        const maxDrain = (m: (typeof mods)[number]) =>
          (m.baseDrain ?? 0) + (m.fusionLimit ?? 0);
        copy.sort(
          (a, b) => maxDrain(b) - maxDrain(a) || a.name.localeCompare(b.name),
        );
        break;
      }
      case "Rarity":
        copy.sort(
          (a, b) =>
            (RARITY_ORDER[a.rarity as Exclude<RarityFilter, "All">] ?? 99) -
              (RARITY_ORDER[b.rarity as Exclude<RarityFilter, "All">] ?? 99) ||
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

  // One pass: partition `ordered` into matches vs non-matches, and track the
  // match set. When searching, matches float to the front so they're visible
  // without scrolling; otherwise `displayed` === `ordered`.
  const { displayed, matches } = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase();
    const hasQuery = q.length > 0;
    const hasRarity = rarity !== "All";
    const hasPolarity = polarity !== "All";

    const kindPred = slotKindPredicate(selectedSlotKind);

    const set = new Set<string>();
    const hits: Mod[] = [];
    const rest: Mod[] = [];
    for (const m of ordered) {
      const matchesFilters =
        (!hasRarity || m.rarity === rarity) &&
        (!hasPolarity || m.polarity === polarity) &&
        (!hasQuery || (searchIndex.get(m.uniqueName) ?? "").includes(q)) &&
        (!kindPred || kindPred(m));
      if (matchesFilters) {
        set.add(m.uniqueName);
        hits.push(m);
      } else {
        rest.push(m);
      }
    }
    // Float matches to the front whenever a narrowing filter is active
    // (search query or a slot-kind target). Rarity/polarity filters just dim
    // in place — they're coarser and reshuffling would be disorienting.
    const shouldFloat = hasQuery || !!kindPred;
    return {
      matches: set,
      displayed: shouldFloat ? [...hits, ...rest] : ordered,
    };
  }, [ordered, deferredQuery, rarity, polarity, searchIndex, selectedSlotKind]);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <InputGroup className="flex-1">
          <InputGroupAddon>
            <Search className="size-4" />
          </InputGroupAddon>
          <InputGroupInput
            ref={searchRef}
            placeholder="Search mods…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          {query.length > 0 ? (
            <InputGroupAddon align="inline-end">
              <span className="text-muted-foreground text-xs tabular-nums">
                {matches.size} / {mods.length}
              </span>
              <InputGroupButton
                size="icon-xs"
                onClick={() => setQuery("")}
                aria-label="Clear search"
              >
                <X />
              </InputGroupButton>
            </InputGroupAddon>
          ) : (
            <InputGroupAddon align="inline-end">
              <span className="text-muted-foreground text-xs tabular-nums">
                {matches.size} / {mods.length}
              </span>
              <Kbd>/</Kbd>
            </InputGroupAddon>
          )}
        </InputGroup>

        <div className="flex gap-2">
          <FilterSelect
            value={sort}
            onChange={setSort}
            options={SORT_OPTIONS}
          />
          <FilterSelect
            value={rarity}
            onChange={setRarity}
            options={RARITY_OPTIONS}
          />
          <FilterSelect
            value={polarity}
            onChange={setPolarity}
            options={POLARITY_OPTIONS}
            labelFor={(v) => (v === "All" ? "All" : cap(v))}
          />
        </div>
      </div>

      {/* Positions stay stable under filters: non-matches dim but keep their
          slot so the eye doesn't lose its spot. */}
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
          const isUsed = usedModNames?.has(mod.name) ?? false;
          const isMatch = matches.has(mod.uniqueName);
          return (
            <ModCard
              key={mod.uniqueName}
              mod={mod}
              onClick={onSelect && !isUsed ? () => onSelect(mod) : undefined}
              className={cn(
                "transition-opacity duration-150",
                !isMatch && "pointer-events-none opacity-20 saturate-0",
                isUsed && "pointer-events-none opacity-30 grayscale",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}
