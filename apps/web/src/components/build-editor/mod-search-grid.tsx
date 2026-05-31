import { isStanceMod } from "@arsenyx/shared/warframe/mods"
import { isRivenMod } from "@arsenyx/shared/warframe/rivens"
import type { Mod, Polarity } from "@arsenyx/shared/warframe/types"
import { Search, X } from "lucide-react"
import {
  memo,
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent,
} from "react"

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
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useHotkey } from "@/lib/hooks/hotkeys"
import {
  BASE_ELEMENTS,
  DAMAGE_TYPE_COLORS,
  type DamageType,
  ELEMENTAL_COMBINATIONS,
} from "@/lib/stats/types"
import { capitalize, cn } from "@/lib/util/utils"

import { useStartDrag } from "./drag-controller"
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
// PvE is the default — Conclave (PvP) mods are flagged with `isConclave`
// at build time (see scripts/build/merge-mods.ts) and hidden unless the
// user explicitly opts into the Conclave view.
const GAME_MODE_OPTIONS = ["PvE", "Conclave"] as const

type SortOption = (typeof SORT_OPTIONS)[number]
type RarityFilter = (typeof RARITY_OPTIONS)[number]
type PolarityFilter = (typeof POLARITY_OPTIONS)[number]
type GameModeFilter = (typeof GAME_MODE_OPTIONS)[number]

const RARITY_ORDER: Record<Exclude<RarityFilter, "All">, number> = {
  Common: 0,
  Uncommon: 1,
  Rare: 2,
  Legendary: 3,
}

const HTML_TAG_PATTERN = /<[^>]+>/g

const UNCOMBINED_TAG_TO_COMBINED: ReadonlyArray<readonly [string, string[]]> =
  Object.entries(DAMAGE_TYPE_COLORS).flatMap(([tag, element]) => {
    if (!BASE_ELEMENTS.includes(element)) return []
    const combos = BASE_ELEMENTS.filter((other) => other !== element)
      .map((other) => ELEMENTAL_COMBINATIONS[`${element}+${other}`])
      .filter((c): c is DamageType => Boolean(c))
    return [[tag, [...new Set(combos)]] as const]
  })

// Community shorthand for common attributes — "cc" surfaces critical chance
// mods, etc. Phrases match the lowercased plain-text stat lines, so the
// canonical form (e.g. "critical chance") is already searchable on its own;
// these aliases only add what isn't a substring of the phrase itself.
const STAT_ALIASES: ReadonlyArray<readonly [string, string[]]> = [
  ["critical chance", ["cc"]],
  ["critical damage", ["cd"]],
  ["status chance", ["sc"]],
  ["status duration", ["sd"]],
  ["multishot", ["ms"]],
  ["punch through", ["pt"]],
  ["fire rate", ["fr"]],
  ["reload speed", ["rs"]],
  ["health", ["hp"]],
]

function getSearchable(mod: Mod): string {
  const name = mod.name.toLowerCase()
  const desc = mod.description?.toLowerCase() ?? ""
  // Mod target metadata: `compatName` is the weapon class ("Rifle",
  // "Shotgun", "Polearm") and `type` is the slot category ("Primary Mod",
  // "Stance"). Both are what users actually type — see issue #160.
  const target = `${mod.compatName ?? ""} ${mod.type ?? ""}`.toLowerCase()
  const rawStats = mod.levelStats?.[mod.levelStats.length - 1]?.stats ?? []
  const combined = new Set<string>()
  for (const stat of rawStats) {
    for (const [tag, combos] of UNCOMBINED_TAG_TO_COMBINED) {
      if (stat.includes(tag)) for (const c of combos) combined.add(c)
    }
  }
  const stats = rawStats
    .map((s) => s.replace(HTML_TAG_PATTERN, ""))
    .join(" ")
    .toLowerCase()
  const aliases = new Set<string>()
  for (const [phrase, shorts] of STAT_ALIASES) {
    if (stats.includes(phrase)) for (const s of shorts) aliases.add(s)
  }
  const combinedStr = combined.size > 0 ? ` ${[...combined].join(" ")}` : ""
  const aliasStr = aliases.size > 0 ? ` ${[...aliases].join(" ")}` : ""
  return `${name} ${desc} ${target} ${stats}${combinedStr}${aliasStr}`
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
  if (kind === "stance") return (m: Mod) => isStanceMod(m)
  return (m: Mod) => !isAuraMod(m) && !isStanceMod(m) && isExilusCompatible(m)
}

const SLOT_KIND_REASON: Record<"aura" | "stance" | "exilus", string> = {
  aura: "Only aura mods fit the aura slot",
  stance: "Only stance mods fit the stance slot",
  exilus: "Only exilus mods fit the exilus slot",
}

// Why a card is dimmed, for the hover tooltip. Returns null for a normal match
// and — deliberately — for a card dimmed only because it doesn't match the
// search query: that's the user's own filter, so it needs no explanation.
// "Already equipped" wins over the slot-kind reason; it's the more actionable
// thing to tell someone hunting for a mod they can't find.
function incompatibilityReason(
  mod: Mod,
  kind: ModSlotKind | undefined,
  isUsed: boolean,
): string | null {
  if (isUsed) return "Already equipped in this build"
  if (!kind || kind === "normal") return null
  const pred = slotKindPredicate(kind)
  return pred && !pred(mod) ? SLOT_KIND_REASON[kind] : null
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
  const [gameMode, setGameMode] = useState<GameModeFilter>("PvE")
  const searchRef = useRef<HTMLInputElement>(null)
  const cardRefs = useRef<Map<string, HTMLDivElement | null>>(new Map())

  const focusInput = () => {
    searchRef.current?.focus()
    searchRef.current?.select()
  }

  useHotkey("/", focusInput)

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

  // Two-tier model:
  //   1. Hard filters remove mods from the grid entirely. Game mode (PvE
  //      hides Conclave / Conclave shows only Conclave), rarity, and
  //      polarity all narrow the visible set — picking "Madurai" should
  //      not leave the user staring at a wall of dimmed Vazarin tiles.
  //   2. Soft filters (search query, slot-kind target) keep all tiles
  //      visible but float matches to the front and dim non-matches, so
  //      typing a partial query doesn't strand the user mid-grid if they
  //      mistype.
  const hardFiltered = useMemo(() => {
    const wantConclave = gameMode === "Conclave"
    return ordered.filter((m) => {
      if (wantConclave ? !m.isConclave : m.isConclave) return false
      if (rarity !== "All" && m.rarity !== rarity) return false
      if (polarity !== "All" && m.polarity !== polarity) return false
      return true
    })
  }, [ordered, gameMode, rarity, polarity])

  const { displayed, matches } = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    const hasQuery = q.length > 0
    const kindPred = slotKindPredicate(selectedSlotKind)

    const set = new Set<string>()
    const hits: Mod[] = []
    const rest: Mod[] = []
    for (const m of hardFiltered) {
      const matchesFilters =
        (!hasQuery || (searchIndex.get(m.uniqueName) ?? "").includes(q)) &&
        (!kindPred || kindPred(m))
      if (matchesFilters) {
        set.add(m.uniqueName)
        hits.push(m)
      } else {
        rest.push(m)
      }
    }
    const shouldFloat = hasQuery || !!kindPred
    return {
      matches: set,
      displayed: shouldFloat ? [...hits, ...rest] : hardFiltered,
    }
  }, [hardFiltered, deferredQuery, searchIndex, selectedSlotKind])

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

  // Latest-values refs so the per-cell key handler can stay referentially
  // stable — otherwise every parent render hands all ~200 memoized cells a
  // new function prop and bypasses the memo. The `index` map turns the
  // per-keystroke uniqueName → position lookup from O(n) findIndex to O(1).
  const index = useMemo(() => {
    const m = new Map<string, number>()
    for (let i = 0; i < displayed.length; i++) m.set(displayed[i].uniqueName, i)
    return m
  }, [displayed])
  const navRef = useRef({ displayed, matches, usedModNames, index })
  useEffect(() => {
    navRef.current = { displayed, matches, usedModNames, index }
  }, [displayed, matches, usedModNames, index])

  const moveFromDisplayedIndex = useCallback(
    (from: number, dir: Dir): number | null => {
      const { displayed: cur, matches: m, usedModNames: u } = navRef.current
      const row = from % GRID_ROWS
      const focusable = (i: number) =>
        i >= 0 &&
        i < cur.length &&
        m.has(cur[i].uniqueName) &&
        !(u?.has(cur[i].name) ?? false)

      if (dir === "up") {
        if (row === 0) return null
        return focusable(from - 1) ? from - 1 : null
      }
      if (dir === "down") {
        if (row === GRID_ROWS - 1) return null
        return focusable(from + 1) ? from + 1 : null
      }
      const step = dir === "right" ? GRID_ROWS : -GRID_ROWS
      for (let i = from + step; i >= 0 && i < cur.length; i += step) {
        if (i % GRID_ROWS !== row) continue
        if (focusable(i)) return i
      }
      return null
    },
    [],
  )

  const focusDisplayedIndex = useCallback((i: number) => {
    const un = navRef.current.displayed[i]?.uniqueName
    if (!un) return
    const el = cardRefs.current.get(un)
    if (!el) return
    el.focus({ preventScroll: true })
    el.scrollIntoView({ block: "nearest", inline: "nearest" })
  }, [])

  const registerCardRef = useCallback(
    (uniqueName: string, el: HTMLDivElement | null) => {
      cardRefs.current.set(uniqueName, el)
    },
    [],
  )

  const onSelectRef = useRef(onSelect)
  onSelectRef.current = onSelect

  // Stable wrapper so memoized cells don't re-render when the parent passes
  // a fresh `onSelect` closure each render. `null` keeps the cell aware
  // that placement is disabled (read-only view).
  const handleSelect = useCallback((mod: Mod) => onSelectRef.current?.(mod), [])
  const cellOnSelect = onSelect ? handleSelect : undefined

  // Stable per-cell key handler. Reads the live `displayed` from the ref so
  // we don't have to rebuild the function (and re-render every cell) when
  // filters narrow the list.
  const handlePoolKeyDown = useCallback(
    (mod: Mod, e: React.KeyboardEvent<HTMLDivElement>) => {
      const idx = navRef.current.index.get(mod.uniqueName) ?? -1
      if (idx === -1) return
      switch (e.key) {
        case "ArrowLeft":
        case "ArrowRight":
        case "ArrowUp":
        case "ArrowDown": {
          e.preventDefault()
          const next = moveFromDisplayedIndex(idx, DIR_BY_KEY[e.key])
          if (next !== null) focusDisplayedIndex(next)
          break
        }
        case "Enter":
        case " ":
          if (!onSelectRef.current) return
          e.preventDefault()
          onSelectRef.current(mod)
          focusInput()
          break
        case "Escape":
          e.preventDefault()
          focusInput()
          break
      }
    },
    [moveFromDisplayedIndex, focusDisplayedIndex],
  )

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
                const first = displayed.find((m) => m.uniqueName === firstName)
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
                {matches.size} / {hardFiltered.length}
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
                {matches.size} / {hardFiltered.length}
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
            labelFor={(v) => (v === "All" ? "All" : capitalize(v))}
          />
          <FilterSelect
            value={gameMode}
            onChange={setGameMode}
            options={GAME_MODE_OPTIONS}
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
            <PoolCardCell
              key={mod.uniqueName}
              mod={mod}
              isMatch={isMatch}
              isUsed={isUsed}
              isFocusable={isFocusable}
              reason={incompatibilityReason(mod, selectedSlotKind, isUsed)}
              draggable={!!onSelect}
              registerRef={registerCardRef}
              onSelect={cellOnSelect}
              onKeyDown={handlePoolKeyDown}
            />
          )
        })}
      </div>
    </div>
  )
}

interface PoolCardCellProps {
  mod: Mod
  isMatch: boolean
  isUsed: boolean
  isFocusable: boolean
  /** When set, the card is dimmed for this reason; surfaced via a tooltip. */
  reason: string | null
  draggable: boolean
  registerRef: (uniqueName: string, el: HTMLDivElement | null) => void
  onSelect?: (mod: Mod) => void
  onKeyDown: (mod: Mod, e: React.KeyboardEvent<HTMLDivElement>) => void
}

const PoolCardCell = memo(function PoolCardCell({
  mod,
  isMatch,
  isUsed,
  isFocusable,
  reason,
  draggable,
  registerRef,
  onSelect,
  onKeyDown,
}: PoolCardCellProps) {
  // No drag state subscription here — the drag controller adds an
  // `is-drag-source` class directly to this element when activation
  // fires, and source-styling is driven from CSS. That way 200 pool
  // cards never re-render mid-drag.
  const startDrag = useStartDrag()
  const setRef = useCallback(
    (el: HTMLDivElement | null) => registerRef(mod.uniqueName, el),
    [mod.uniqueName, registerRef],
  )
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => onKeyDown(mod, e),
    [mod, onKeyDown],
  )
  const handleClick = useCallback(() => onSelect?.(mod), [mod, onSelect])
  const handlePointerDown = useCallback(
    (e: PointerEvent<HTMLDivElement>) => {
      if (!startDrag || !draggable || !isFocusable) return
      startDrag({ kind: "pool", mod }, e)
    },
    [startDrag, draggable, isFocusable, mod],
  )
  const cell = (
    <div
      ref={setRef}
      tabIndex={-1}
      onKeyDown={isFocusable ? handleKeyDown : undefined}
      onPointerDown={handlePointerDown}
      // Mod cards contain <img> elements which the browser will start a
      // native drag-and-drop on by default. We suppress that here so our
      // pointer-based drag controller owns the gesture cleanly.
      onDragStart={(e) => e.preventDefault()}
      className={cn(
        "outline-none",
        isFocusable && "focus-visible:brightness-125",
        // Drag source styling is applied by the drag controller via the
        // `is-drag-source` class on this element — see globals.css. Using
        // a class avoids the re-render storm that came with subscribing
        // every pool card to drag state.
        isFocusable && draggable && "cursor-grab active:cursor-grabbing",
      )}
    >
      <ModCard
        mod={mod}
        onClick={onSelect && !isUsed ? handleClick : undefined}
        className={cn(
          "transition-opacity duration-150",
          !isMatch && "pointer-events-none opacity-20 saturate-0",
          isUsed && "pointer-events-none opacity-30 grayscale",
        )}
      />
    </div>
  )

  // Only dimmed-for-a-reason cards carry a tooltip. Plain matches and
  // search-only non-matches stay tooltip-free, so the common browsing case
  // mounts zero tooltip roots.
  if (!reason) return cell
  return (
    <Tooltip>
      <TooltipTrigger render={cell} />
      <TooltipContent>{reason}</TooltipContent>
    </Tooltip>
  )
})
