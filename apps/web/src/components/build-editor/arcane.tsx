import type { Arcane } from "@arsenyx/shared/warframe/types"
import { Plus, Search, X } from "lucide-react"
import {
  type MouseEvent,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react"

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { getArcaneImageUrl } from "@/lib/util/arcane-images"
import { cn } from "@/lib/util/utils"
import { marketUrl, wikiUrl } from "@/lib/util/warframe-links"

import { StatText } from "../stat-text"
import { BuildItemDetail } from "./item-detail"
import { useRankHover } from "./rank-hover"
import { arcaneMaxRank, arcaneStatsAt as statsAt } from "./slot-ranks"
import type { PlacedArcane } from "./use-arcane-slots"

interface ArcaneCardProps {
  arcane: Arcane
  rank: number
  /** Arcane slot index — identifies this card to the shared rank-hotkey owner. */
  slotIndex?: number
  /** Called with -1/+1 when the user presses -/+ while hovering. Caller clamps. */
  onRankChange?: (delta: -1 | 1) => void
  onClick?: () => void
  isSelected?: boolean
  disableHover?: boolean
  className?: string
}

export function ArcaneCard({
  arcane,
  rank: currentRank,
  slotIndex,
  onRankChange,
  onClick,
  isSelected,
  disableHover = false,
  className,
}: ArcaneCardProps) {
  const rankHover = useRankHover()
  // Rank hotkeys are owned by a single listener in editor-shell; this card just
  // advertises itself as the hovered target. Arcanes rank on hover only (never
  // on selection), matching the prior behavior. No-op without a provider.
  const canRank = !disableHover && !!onRankChange && slotIndex != null

  // When the picker opens, `disableHover` flips true and both mouse handlers
  // below go undefined — so a stale hover registration could otherwise linger
  // and let `-`/`+` rank this arcane behind the open picker. Clear it
  // explicitly. `clear` is a no-op unless this card is still the active target.
  useEffect(() => {
    if (disableHover && rankHover && slotIndex != null) {
      rankHover.clear({ kind: "arcane", index: slotIndex })
    }
  }, [disableHover, rankHover, slotIndex])

  const stats = statsAt(arcane, currentRank)
  const formattedStats = stats.join("\n")

  const card = (
    <div
      className={cn(
        "bg-card/80 relative flex h-[100px] w-[140px] flex-col items-center overflow-hidden rounded-md select-none",
        onClick && "cursor-pointer",
        isSelected &&
          "ring-primary ring-offset-background ring-2 ring-offset-1",
        className,
      )}
      onMouseEnter={
        canRank && rankHover
          ? () => rankHover.set({ kind: "arcane", index: slotIndex! })
          : undefined
      }
      onMouseLeave={
        canRank && rankHover
          ? () => rankHover.clear({ kind: "arcane", index: slotIndex! })
          : undefined
      }
      onClick={onClick}
    >
      <div className="relative mt-1.5 h-[65px] w-[80px] overflow-hidden rounded">
        <img
          src={getArcaneImageUrl(arcane.imageName)}
          alt={arcane.name}
          className="h-full w-full object-cover"
        />
      </div>
      <span className="text-foreground mt-1 line-clamp-1 px-1 text-center text-[10px] leading-tight font-medium">
        {arcane.name}
      </span>
      <span className="text-muted-foreground mt-0.5 text-[9px] font-medium">
        RANK {currentRank}
      </span>
    </div>
  )

  if (disableHover || !formattedStats) return card

  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger render={card} />
        <TooltipContent
          side="bottom"
          className="max-w-[280px] p-3"
          sideOffset={4}
        >
          <div className="flex flex-col gap-2">
            <div className="font-medium">{arcane.name}</div>
            <div className="text-[10px] uppercase opacity-70">
              Rank {currentRank}
            </div>
            <div className="text-xs leading-relaxed opacity-80">
              <StatText text={formattedStats} />
            </div>
            {onRankChange && (
              <div className="border-t border-current/20 pt-1 text-[9px] opacity-50">
                Press +/- to change rank
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

interface ArcaneSlotProps {
  options: Arcane[]
  placed?: PlacedArcane | null
  /** This slot's index — forwarded to ArcaneCard for the rank-hotkey owner. */
  slotIndex?: number
  /** Placeholder text shown when the slot is empty. Defaults to "Arcane". */
  label?: string
  /** Names of arcanes already placed in sibling slots — dimmed in the picker. */
  usedNames?: Set<string>
  selected?: boolean
  onSelect?: () => void
  onPick: (arcane: Arcane) => void
  onRemove?: () => void
  onRankChange?: (delta: -1 | 1) => void
  readOnly?: boolean
}

export function ArcaneSlot({
  options,
  placed,
  slotIndex,
  label = "Arcane",
  usedNames,
  selected,
  onSelect,
  onPick,
  onRemove,
  onRankChange,
  readOnly = false,
}: ArcaneSlotProps) {
  const [open, setOpen] = useState(false)

  const arcaneStats: string[] = placed
    ? statsAt(placed.arcane, placed.rank)
    : []

  const handleContextMenu = (e: MouseEvent) => {
    if (readOnly) return
    if (placed && onRemove) {
      e.preventDefault()
      onRemove()
    }
  }

  return (
    <Popover
      open={open}
      onOpenChange={readOnly && !placed ? undefined : setOpen}
    >
      <PopoverTrigger
        nativeButton={false}
        // Same reasoning as mod-slot.tsx: arrow-key nav drives selection,
        // Tab order would just visually enlarge the focused slot via the
        // browser's default focus ring.
        render={<div tabIndex={-1} />}
        data-build-slot
        onClick={
          readOnly
            ? placed
              ? () => setOpen(true)
              : undefined
            : () => {
                onSelect?.()
                setOpen(true)
              }
        }
        onContextMenu={handleContextMenu}
        className={cn(
          "group relative flex h-[80px] w-full max-w-[140px] flex-col items-center justify-center transition-colors",
          "sm:h-[90px] sm:w-[120px] sm:flex-none md:h-[100px] md:w-[140px]",
          "outline-none",
          (!readOnly || !!placed) && "cursor-pointer",
          !placed && "rounded-md border",
          !placed &&
            !readOnly &&
            (selected
              ? "border-solid border-white/70"
              : "border-muted-foreground/10 hover:border-muted-foreground/25 border-dashed"),
          !placed && readOnly && "border-muted-foreground/10 border-dashed",
          placed && selected && !readOnly && "rounded-md ring-2 ring-white/60",
        )}
      >
        {placed ? (
          <ArcaneCard
            arcane={placed.arcane}
            rank={placed.rank}
            slotIndex={slotIndex}
            onRankChange={readOnly ? undefined : onRankChange}
            disableHover={open}
          />
        ) : (
          <>
            <Plus className="text-muted-foreground/15 group-hover:text-muted-foreground/30 size-6 transition-colors" />
            <span className="text-muted-foreground/30 mt-1 font-mono text-[10px] tracking-wide uppercase">
              {label}
            </span>
          </>
        )}
      </PopoverTrigger>
      {(!readOnly || placed) && (
        <PopoverContent className="w-auto p-3" align="center">
          {readOnly && placed ? (
            <BuildItemDetail
              name={placed.arcane.name}
              imageUrl={getArcaneImageUrl(placed.arcane.imageName)}
              meta={placed.arcane.type}
              rank={placed.rank}
              maxRank={arcaneMaxRank(placed.arcane)}
              stats={arcaneStats}
              description={placed.arcane.description}
              wikiHref={wikiUrl(placed.arcane.name)}
              marketHref={
                placed.arcane.tradable
                  ? marketUrl(placed.arcane.name)
                  : undefined
              }
            />
          ) : (
            <ArcanePicker
              options={options}
              usedNames={usedNames}
              onPick={(a) => {
                onPick(a)
                setOpen(false)
              }}
            />
          )}
        </PopoverContent>
      )}
    </Popover>
  )
}

function ArcanePicker({
  options,
  usedNames,
  onPick,
}: {
  options: Arcane[]
  usedNames?: Set<string>
  onPick: (arcane: Arcane) => void
}) {
  const [query, setQuery] = useState("")
  const deferred = useDeferredValue(query)

  const sorted = useMemo(
    () => [...options].sort((a, b) => a.name.localeCompare(b.name)),
    [options],
  )

  const filtered = useMemo(() => {
    const q = deferred.trim().toLowerCase()
    if (!q) return sorted
    return sorted.filter((a) => {
      if (a.name.toLowerCase().includes(q)) return true
      const last = statsAt(a, (a.levelStats?.length ?? 0) - 1)
      return last.some((s) => s.toLowerCase().includes(q))
    })
  }, [sorted, deferred])

  return (
    <div className="flex flex-col gap-2" style={{ width: 448 }}>
      <InputGroup>
        <InputGroupAddon>
          <Search className="size-4" />
        </InputGroupAddon>
        <InputGroupInput
          autoFocus
          placeholder="Search arcanes…"
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

      <div className="grid max-h-[320px] grid-cols-3 gap-2 overflow-y-auto pr-1">
        {filtered.map((arcane) => {
          const isUsed = usedNames?.has(arcane.name)
          return (
            <button
              key={arcane.uniqueName}
              type="button"
              disabled={isUsed}
              onClick={() => onPick(arcane)}
              className={cn(
                "hover:bg-accent focus-visible:ring-primary relative flex h-[64px] w-full items-center gap-2 rounded-md border p-1.5 text-left transition-colors focus-visible:ring-2 focus-visible:outline-none",
                isUsed && "pointer-events-none opacity-30 grayscale",
              )}
            >
              <img
                src={getArcaneImageUrl(arcane.imageName)}
                alt=""
                className="size-10 shrink-0 rounded object-cover"
              />
              <span className="line-clamp-2 text-[11px] leading-tight font-medium">
                {arcane.name}
              </span>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="text-muted-foreground col-span-full py-4 text-center text-sm">
            No arcanes match.
          </p>
        )}
      </div>
    </div>
  )
}
