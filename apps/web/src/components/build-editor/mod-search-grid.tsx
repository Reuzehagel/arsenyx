import { isRivenMod } from "@arsenyx/shared/warframe/rivens"
import type { Mod, Polarity } from "@arsenyx/shared/warframe/types"
import { Search, X } from "lucide-react"
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn, isEditableTarget } from "@/lib/utils"

import { ModCard } from "./mod-card"
import type { ModSlotKind } from "./mod-slot"
import { isAuraMod, isExilusCompatible } from "./use-build-slots"
import { DIR_BY_KEY, type Dir } from "./use-keyboard-nav"

const SORT_OPTIONS = ["Drain", "Name", "Rarity"] as const
const RARITY_OPTIONS = [
  "All",
  "Common",
  "Uncommon",
  "Rare",
  "Legendary",
] as const
const POLARITY_OPTIONS = [
  "All",
  "madurai",
  "vazarin",
  "naramon",
  "zenurik",
  "unairu",
  "penjaga",
  "umbra",
] as const satisfies readonly ("All" | Polarity)[]

type SortOption = (typeof SORT_OPTIONS)[number]
type RarityFilter = (typeof RARITY_OPTIONS)[number]
type PolarityFilter = (typeof POLARITY_OPTIONS)[number]

const RARITY_ORDER: Record<Exclude<RarityFilter, "All">, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Legendary: 3,
}

const HTML_TAG_PATTERN = /<[^>]+>/g

function getSearchable(mod: Mod): string {
  const name = mod.name.toLowerCase()
  const desc = mod.description?.toLowerCase() ?? ""
  const stats =
    mod.levelStats?.[mod.levelStats.length - 1]?.stats
      ?.map((s) => s.replace(HTML_TAG_PATTERN, ""))
      .join(" ")
      .toLowerCase() ?? ""
  return `${name} ${desc} ${stats}`
}

function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

interface FilterSelectProps<T extends string> {
  value: T
  onChange: (v: T) => void
  options: readonly T[]
  labelFor?: (v: T) => string
}

function FilterSelect<T extends string>({
  value,
  onChange,
  options,
  labelFor,
}: FilterSelectProps<T>) {
  const items = options.map((o) => ({
    label: labelFor ? labelFor(o) : o,
    value: o,
  }))
  return (
    <Select items={items} value={value} onValueChange={(v) => onChange(v as T)}>
      <SelectTrigger className="w-36">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectGroup>
          {options.map((o) => (
            <SelectItem key={o} value={o}>
              {labelFor ? labelFor(o) : o}
            </SelectItem>
          ))}
        </SelectGroup>
      </SelectContent>
    </Select>
  )
}

interface ModSearchGridProps {
  mods: Mod[]
  usedModNames?: Set<string>
  onSelect?: (mod: Mod) => void
  /**
   * When set, mods incompatible with this slot kind are dimmed (aura-only for
   * the aura slot, exilus/utility-only for exilus). `"normal"` or undefined
   * disables the kind filter.
   */
  selectedSlotKind?: ModSlotKind
}

function slotKindPredicate(kind: ModSlotKind | undefined) {
  if (!kind || kind === "normal") return null
  if (kind === "aura") return (m: Mod) => isAuraMod(m)
  return (m: Mod) => !isAuraMod(m) && isExilusCompatible(m)
}

export function ModSearchGrid({
  mods,
  usedModNames,
  onSelect,
  selectedSlotKind,
}: ModSearchGridProps) {
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const [sort, setSort] = useState<SortOption>("Drain")
  const [rarity, setRarity] = useState<RarityFilter>("All")
  const [polarity, setPolarity] = useState<PolarityFilter>("All")
  const searchRef = useRef<HTMLInputElement>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())

  const focusInput = () => {
    searchRef.current?.focus()
    searchRef.current?.select()
  }

  // `/` focuses the search from anywhere on the page, mirroring the browse page.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "/") return
      if (isEditableTarget(e.target)) return
      e.preventDefault()
      searchRef.current?.focus()
      searchRef.current?.select()
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  // Stable ordering: computed from `mods` + `sort` only. Filters dim instead
  // of remove, so positions don't shift when search/rarity/polarity narrow
  // the view — mirrors how the in-game arsenal keeps mods in place.
  const ordered = useMemo(() => {
    // Rivens always pin to the front — they're a special action, not a
    // regular mod, and sorting them by drain/rarity buries them.
    const rivens = mods.filter(isRivenMod)
    const copy = mods.filter((m) => !isRivenMod(m))
    switch (sort) {
      case "Name":
        copy.sort((a, b) => a.name.localeCompare(b.name))
        break
      case "Drain": {
        const maxDrain = (m: (typeof mods)[number]) =>
          (m.baseDrain ?? 0) + (m.fusionLimit ?? 0)
        copy.sort(
          (a, b) => maxDrain(b) - maxDrain(a) || a.name.localeCompare(b.name),
        )
        break
      }
      case "Rarity":
        copy.sort(
          (a, b) =>
            (RARITY_ORDER[a.rarity as Exclude<RarityFilter, "All">] ?? 99) -
              (RARITY_ORDER[b.rarity as Exclude<RarityFilter, "All">] ?? 99) ||
            a.name.localeCompare(b.name),
        )
        break
    }
    return [...rivens, ...copy]
  }, [mods, sort])

  const searchIndex = useMemo(() => {
    const map = new Map<string, string>()
    for (const m of mods) map.set(m.uniqueName, getSearchable(m))
    return map
  }, [mods])

  // One pass: partition `ordered` into matches vs non-matches, and track the
  // match set. When searching, matches float to the front so they're visible
  // without scrolling; otherwise `displayed` === `ordered`.
  const { displayed, matches } = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    const hasQuery = q.length > 0
    const hasRarity = rarity !== "All"
    const hasPolarity = polarity !== "All"

    const kindPred = slotKindPredicate(selectedSlotKind)

    const set = new Set<string>()
    const hits: Mod[] = []
    const rest: Mod[] = []
    for (const m of ordered) {
      const matchesFilters =
        (!hasRarity || m.rarity === rarity) &&
        (!hasPolarity || m.polarity === polarity) &&
        (!hasQuery || (searchIndex.get(m.uniqueName) ?? "").includes(q)) &&
        (!kindPred || kindPred(m))
      if (matchesFilters) {
        set.add(m.uniqueName)
        hits.push(m)
      } else {
        rest.push(m)
      }
    }
    // Float matches to the front whenever a narrowing filter is active
    // (search query or a slot-kind target). Rarity/polarity filters just dim
    // in place — they're coarser and reshuffling would be disorienting.
    const shouldFloat = hasQuery || !!kindPred
    return {
      matches: set,
      displayed: shouldFloat ? [...hits, ...rest] : ordered,
    }
  }, [ordered, deferredQuery, rarity, polarity, searchIndex, selectedSlotKind])

  // Ordered list of uniqueNames the user can Tab/arrow into. Mirrors
  // `displayed` but skips dimmed (non-match) and used mods — those aren't
  // actionable. Tab from the input lands on `focusableOrder[0]`; arrow keys
  // step through this list.
  const focusableOrder = useMemo(() => {
    const out: string[] = []
    for (const m of displayed) {
      if (!matches.has(m.uniqueName)) continue
      if (usedModNames?.has(m.name)) continue
      out.push(m.uniqueName)
    }
    return out
  }, [displayed, matches, usedModNames])

  // Grid is 2 rows, column-flow: displayed[i] sits at row = i % 2, col = i / 2.
  // Navigate in visual 2D, skipping dimmed/used cards by continuing in the
  // same direction until a focusable card is found (or clamp at the edge).
  const GRID_ROWS = 2
  const moveFromDisplayedIndex = (
    from: number,
    dir: Dir,
  ): number | null => {
    const row = from % GRID_ROWS
    const col = Math.floor(from / GRID_ROWS)
    const focusable = (i: number) =>
      i >= 0 &&
      i < displayed.length &&
      matches.has(displayed[i].uniqueName) &&
      !(usedModNames?.has(displayed[i].name) ?? false)

    if (dir === "up") {
      if (row === 0) return null
      return focusable(from - 1) ? from - 1 : null
    }
    if (dir === "down") {
      if (row === GRID_ROWS - 1) return null
      return focusable(from + 1) ? from + 1 : null
    }
    // left/right: step by one column; if the landing cell isn't focusable,
    // keep walking in the same direction until one is found or we run out.
    const step = dir === "right" ? GRID_ROWS : -GRID_ROWS
    for (let i = from + step; i >= 0 && i < displayed.length; i += step) {
      // Stay in the same row — column stepping already preserves it, but the
      // column count implied by displayed.length can leave a "hole" at the
      // last partial column, which we skip over transparently.
      if (i % GRID_ROWS !== row) continue
      if (focusable(i)) return i
    }
    return null
  }

  const focusDisplayedIndex = (i: number) => {
    const un = displayed[i]?.uniqueName
    if (!un) return
    const el = cardRefs.current.get(un)
    if (!el) return
    // `preventScroll` stops the browser from scrolling the page vertically
    // to the focused card; we still want the horizontal overflow container
    // to follow focus, so do that explicitly with `block: "nearest"`.
    el.focus({ preventScroll: true })
    el.scrollIntoView({ block: "nearest", inline: "nearest" })
  }

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
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                if (!onSelect) return
                const firstName = focusableOrder[0]
                if (!firstName) return
                const first = displayed.find(
                  (m) => m.uniqueName === firstName,
                )
                if (!first) return
                e.preventDefault()
                onSelect(first)
                return
              }
              if (e.key === "Tab" && !e.shiftKey) {
                // Tab from the input jumps into the grid so users can pick a
                // specific match (e.g. Primed Continuity vs Continuity) with
                // arrow keys + Enter. Shift+Tab keeps browser default.
                const firstName = focusableOrder[0] ?? displayed[0]?.uniqueName
                if (!firstName) return
                const el = cardRefs.current.get(firstName)
                if (!el) return
                e.preventDefault()
                el.focus()
              }
            }}
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
        data-mod-search-grid
        className="grid max-w-full content-start gap-x-2 gap-y-4 overflow-x-auto px-1 pt-2 pb-6"
        style={{
          gridTemplateRows: "repeat(2, min-content)",
          gridAutoFlow: "column",
          gridAutoColumns: "200px",
          justifyContent: "start",
        }}
      >
        {displayed.map((mod) => {
          const isUsed = usedModNames?.has(mod.name) ?? false
          const isMatch = matches.has(mod.uniqueName)
          const isFocusable = isMatch && !isUsed
          return (
            <div
              key={mod.uniqueName}
              ref={(el) => {
                cardRefs.current.set(mod.uniqueName, el)
              }}
              tabIndex={-1}
              onKeyDown={
                isFocusable
                  ? (e) => {
                      const idx = displayed.findIndex(
                        (m) => m.uniqueName === mod.uniqueName,
                      )
                      if (idx === -1) return
                      switch (e.key) {
                        case "ArrowLeft":
                        case "ArrowRight":
                        case "ArrowUp":
                        case "ArrowDown": {
                          // Always swallow the event so the page doesn't
                          // scroll when arrows hit a grid edge.
                          e.preventDefault()
                          const next = moveFromDisplayedIndex(
                            idx,
                            DIR_BY_KEY[e.key],
                          )
                          if (next !== null) focusDisplayedIndex(next)
                          break
                        }
                        case "Enter":
                        case " ":
                          if (!onSelect) return
                          e.preventDefault()
                          onSelect(mod)
                          focusInput()
                          break
                        case "Escape":
                          e.preventDefault()
                          focusInput()
                          break
                      }
                    }
                  : undefined
              }
              className={cn(
                "outline-none",
                // Matches the visual language of a selected mod slot in the
                // editor grid — brightness lift instead of a ring, so the
                // stylized card shape isn't boxed in by a rectangle.
                isFocusable && "focus-visible:brightness-125",
              )}
            >
              <ModCard
                mod={mod}
                onClick={onSelect && !isUsed ? () => onSelect(mod) : undefined}
                className={cn(
                  "transition-opacity duration-150",
                  !isMatch && "pointer-events-none opacity-20 saturate-0",
                  isUsed && "pointer-events-none opacity-30 grayscale",
                )}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
