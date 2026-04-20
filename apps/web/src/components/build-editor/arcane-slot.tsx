import type { Arcane } from "@arsenyx/shared/warframe/types"
import { Plus, Search, X } from "lucide-react"
import { type MouseEvent, useDeferredValue, useMemo, useState } from "react"

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
import { getArcaneImageUrl } from "@/lib/arcane-images"
import { cn } from "@/lib/utils"

import { ArcaneCard } from "./arcane-card"
import type { PlacedArcane } from "./use-arcane-slots"

interface ArcaneSlotProps {
  options: Arcane[]
  placed?: PlacedArcane | null
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
  usedNames,
  selected,
  onSelect,
  onPick,
  onRemove,
  onRankChange,
  readOnly = false,
}: ArcaneSlotProps) {
  const [open, setOpen] = useState(false)

  const handleContextMenu = (e: MouseEvent) => {
    if (readOnly) return
    if (placed && onRemove) {
      e.preventDefault()
      onRemove()
    }
  }

  return (
    <Popover open={open} onOpenChange={readOnly ? undefined : setOpen}>
      <PopoverTrigger
        nativeButton={false}
        render={<div />}
        data-build-slot
        onClick={
          readOnly
            ? undefined
            : () => {
                onSelect?.()
                setOpen(true)
              }
        }
        onContextMenu={handleContextMenu}
        className={cn(
          "group relative flex h-[80px] w-full flex-col items-center justify-center transition-colors",
          "sm:h-[90px] sm:w-[120px] sm:flex-none md:h-[100px] md:w-[140px]",
          !readOnly && "cursor-pointer",
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
            onRankChange={readOnly ? undefined : onRankChange}
            disableHover={open}
          />
        ) : (
          <>
            <Plus className="text-muted-foreground/15 group-hover:text-muted-foreground/30 size-6 transition-colors" />
            <span className="text-muted-foreground/30 mt-1 font-mono text-[10px] tracking-wide uppercase">
              Arcane
            </span>
          </>
        )}
      </PopoverTrigger>
      {!readOnly && (
        <PopoverContent className="w-auto p-3" align="center">
          <ArcanePicker
            options={options}
            usedNames={usedNames}
            onPick={(a) => {
              onPick(a)
              setOpen(false)
            }}
          />
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
      const last = a.levelStats?.[a.levelStats.length - 1]?.stats ?? []
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
                src={getArcaneImageUrl(arcane.name)}
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
