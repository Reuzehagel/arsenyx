"use client"

import { useDroppable, useDraggable } from "@dnd-kit/core"
import { CSS } from "@dnd-kit/utilities"
import { Plus, X } from "lucide-react"
import { useState, useMemo, memo } from "react"

import { PolarityIcon } from "@/components/icons"
import { ModCard } from "@/components/mod-card/mod-card"
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
import { cn } from "@/lib/utils"
import {
  getSlotPolarity,
  calculateModDrain,
  calculateAuraBonus,
  getMatchState,
  type MatchState,
} from "@/lib/warframe/capacity"
import type {
  ModSlot,
  Polarity,
  Mod,
  PlacedMod,
  PlacedArcane,
  Arcane,
} from "@/lib/warframe/types"

import { ArcaneSlotCard } from "./arcane-slot-card"

// All available polarities for the selector
const ALL_POLARITIES: Polarity[] = [
  "madurai",
  "vazarin",
  "naramon",
  "zenurik",
  "unairu",
  "penjaga",
  "umbra",
  "any",
]

// Hoisted default value to avoid new reference on every render
const EMPTY_ARCANE_SLOTS: (PlacedArcane | null)[] = []

interface ModGridProps {
  auraSlots: ModSlot[]
  exilusSlot?: ModSlot
  normalSlots: ModSlot[]
  activeSlotId: string | null
  onSelectSlot: (slotId: string) => void
  onRemoveMod: (slotId: string) => void
  onChangeRank: (slotId: string, rank: number) => void
  onApplyForma: (slotId: string, polarity: Polarity) => void
  isWarframe: boolean
  draggedMod?: Mod | PlacedMod
  // Arcane props
  arcaneSlots?: (PlacedArcane | null)[]
  onRemoveArcane?: (index: number) => void
  onChangeArcaneRank?: (index: number, rank: number) => void
  draggedArcane?: Arcane | PlacedArcane
  /** Full arcane data for hydrating placed arcanes (for levelStats display) */
  arcaneDataMap?: Map<string, Arcane>
  /** Read-only mode - disables all interactions */
  readOnly?: boolean
  /** Number of normal slots per row (default: 4) */
  slotsPerRow?: number
}

export function ModGrid({
  auraSlots,
  exilusSlot,
  normalSlots,
  activeSlotId,
  onSelectSlot,
  onRemoveMod,
  onChangeRank,
  onApplyForma,
  isWarframe,
  draggedMod,
  arcaneSlots = EMPTY_ARCANE_SLOTS,
  onRemoveArcane,
  onChangeArcaneRank,
  draggedArcane,
  arcaneDataMap,
  readOnly = false,
  slotsPerRow = 4,
}: ModGridProps) {
  // Calculate set counts
  const setCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    const allSlots = [...auraSlots, exilusSlot, ...normalSlots].filter(
      Boolean,
    ) as ModSlot[]

    for (const slot of allSlots) {
      if (slot.mod?.modSet) {
        counts[slot.mod.modSet] = (counts[slot.mod.modSet] || 0) + 1
      }
    }
    return counts
  }, [auraSlots, exilusSlot, normalSlots])

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-col items-center gap-6 sm:gap-4">
        {/* Row 1: Aura & Exilus (not shown for Necramechs) */}
        {(auraSlots.length > 0 || exilusSlot) && (
          <div className="flex w-full justify-center gap-2 sm:gap-4">
            {isWarframe && auraSlots.map((auraSlot) => (
              <ModSlotCard
                key={auraSlot.id}
                slot={auraSlot}
                isActive={activeSlotId === auraSlot.id}
                onSelect={() => onSelectSlot(auraSlot.id)}
                onRemove={() => onRemoveMod(auraSlot.id)}
                onChangeRank={(rank) => onChangeRank(auraSlot.id, rank)}
                onApplyForma={(polarity) => onApplyForma(auraSlot.id, polarity)}
                label="Aura"
                className="h-[80px] min-w-0 flex-1 sm:h-[90px] sm:w-[150px] sm:flex-none md:h-[100px] md:w-[184px]"
                setCount={
                  auraSlot.mod?.modSet ? setCounts[auraSlot.mod.modSet] : 0
                }
                draggedMod={draggedMod}
                readOnly={readOnly}
              />
            ))}
            {exilusSlot && (
              <ModSlotCard
                slot={exilusSlot}
                isActive={activeSlotId === exilusSlot.id}
                onSelect={() => onSelectSlot(exilusSlot.id)}
                onRemove={() => onRemoveMod(exilusSlot.id)}
                onChangeRank={(rank) => onChangeRank(exilusSlot.id, rank)}
                onApplyForma={(polarity) =>
                  onApplyForma(exilusSlot.id, polarity)
                }
                label="Exilus"
                className="h-[80px] min-w-0 flex-1 sm:h-[90px] sm:w-[150px] sm:flex-none md:h-[100px] md:w-[184px]"
                setCount={
                  exilusSlot.mod?.modSet ? setCounts[exilusSlot.mod.modSet] : 0
                }
                draggedMod={draggedMod}
                readOnly={readOnly}
              />
            )}
          </div>
        )}

        {/* Normal Slots - rendered in rows */}
        {Array.from(
          { length: Math.ceil(normalSlots.length / slotsPerRow) },
          (_, rowIdx) => (
            <div
              key={rowIdx}
              className="grid w-full grid-cols-2 justify-center gap-x-2 gap-y-6 sm:flex sm:gap-4"
            >
              {normalSlots
                .slice(rowIdx * slotsPerRow, rowIdx * slotsPerRow + slotsPerRow)
                .map((slot) => (
                  <ModSlotCard
                    key={slot.id}
                    slot={slot}
                    isActive={activeSlotId === slot.id}
                    onSelect={() => onSelectSlot(slot.id)}
                    onRemove={() => onRemoveMod(slot.id)}
                    onChangeRank={(rank) => onChangeRank(slot.id, rank)}
                    onApplyForma={(polarity) => onApplyForma(slot.id, polarity)}
                    className="h-[80px] w-full sm:h-[90px] sm:w-[150px] md:h-[100px] md:w-[184px]"
                    setCount={slot.mod?.modSet ? setCounts[slot.mod.modSet] : 0}
                    draggedMod={draggedMod}
                    readOnly={readOnly}
                  />
                ))}
            </div>
          ),
        )}

        {/* Row 4: Arcanes */}
        {arcaneSlots.length > 0 && (
          <div className="mt-2 flex w-full justify-center gap-3 sm:gap-6">
            {arcaneSlots.map((arcane, index) => (
              <ArcaneSlotCard
                key={`arcane-${index}`}
                arcane={arcane ?? undefined}
                slotIndex={index}
                isActive={activeSlotId === `arcane-${index}`}
                onSelect={() => onSelectSlot(`arcane-${index}`)}
                onRemove={() => onRemoveArcane?.(index)}
                onChangeRank={(rank) => onChangeArcaneRank?.(index, rank)}
                className="h-[80px] min-w-0 flex-1 sm:h-[90px] sm:w-[120px] sm:flex-none md:h-[100px] md:w-[140px]"
                draggedArcane={draggedArcane}
                fullArcaneData={
                  arcane ? arcaneDataMap?.get(arcane.uniqueName) : undefined
                }
                readOnly={readOnly}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// =============================================================================
// MOD SLOT CARD COMPONENT
// =============================================================================

interface ModSlotCardProps {
  slot: ModSlot
  isActive: boolean
  onSelect: () => void
  onRemove: () => void
  onChangeRank: (rank: number) => void
  onApplyForma: (polarity: Polarity) => void
  slotNumber?: number
  className?: string
  label?: string
  setCount?: number
  draggedMod?: Mod | PlacedMod
  readOnly?: boolean
}

const ModSlotCard = memo(function ModSlotCard({
  slot,
  isActive,
  onSelect,
  onRemove,
  onChangeRank,
  onApplyForma,
  className,
  label,
  setCount = 0,
  draggedMod,
  readOnly = false,
}: ModSlotCardProps) {
  const [polarityOpen, setPolarityOpen] = useState(false)
  const hasMod = !!slot.mod
  const polarity = getSlotPolarity(slot)

  // Determine if this slot should be disabled for the current drag
  const isDropDisabled = useMemo(() => {
    if (!draggedMod) return false

    // Aura slot check
    if (slot.type === "aura" && slot.id.startsWith("aura")) {
      const isAura =
        draggedMod.type?.toLowerCase().includes("aura") ||
        draggedMod.compatName?.toLowerCase() === "aura"
      return !isAura
    }

    // Exilus slot check - both isExilus and isUtility indicate exilus-compatible mods
    if (slot.type === "exilus" && slot.id.startsWith("exilus")) {
      return !draggedMod.isExilus && !draggedMod.isUtility
    }

    // Normal slots accept everything (except maybe Aura?)
    // Technically Aura mods can go in normal slots in game, but users usually don't want to.
    // Logic in BuildContainer doesn't restrict Aura->Normal.
    // If we want to be strict, we can add logic here, but keeping it permissive for normal slots is safer.
    return false
  }, [draggedMod, slot.type, slot.id])

  // Droppable for the slot (disabled in read-only mode)
  const { setNodeRef: setDroppableRef, isOver } = useDroppable({
    id: `slot-${slot.id}`,
    data: { slotId: slot.id, type: "slot" },
    disabled: isDropDisabled || readOnly,
  })

  // Draggable for the placed mod (disabled in read-only mode)
  const {
    attributes,
    listeners,
    setNodeRef: setDraggableRef,
    transform,
    isDragging,
  } = useDraggable({
    id: `placed-${slot.id}`,
    data: { slotId: slot.id, mod: slot.mod, type: "placed-mod" },
    disabled: !hasMod || readOnly,
  })

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined

  // Convert PlacedMod to Mod format for ModCard
  const modForCard: Mod | null = hasMod
    ? {
        uniqueName: slot.mod!.uniqueName,
        name: slot.mod!.name,
        imageName: slot.mod!.imageName,
        polarity: slot.mod!.polarity,
        rarity: (slot.mod!.rarity || "Common") as Mod["rarity"],
        baseDrain: slot.mod!.baseDrain,
        fusionLimit: slot.mod!.fusionLimit,
        compatName: slot.mod!.compatName,
        type: slot.mod!.type || "",
        levelStats: slot.mod!.levelStats,
        modSet: slot.mod!.modSet,
        modSetStats: slot.mod!.modSetStats,
        tradable: false,
      }
    : null

  // Calculate drain and match state for polarity color feedback
  const drain = hasMod
    ? slot.type === "aura"
      ? calculateAuraBonus(slot.mod!, polarity)
      : calculateModDrain(slot.mod!, polarity)
    : 0
  const matchState: MatchState = hasMod
    ? getMatchState(slot.mod!.polarity, polarity)
    : "neutral"

  // Polarity selector content (reused for both filled and empty slots)
  const polaritySelectorContent = (
    <PopoverContent className="w-auto p-2" side="bottom" align="center">
      <div className="flex flex-col gap-2">
        <span className="text-muted-foreground text-xs font-medium">
          Select Polarity
        </span>
        <div className="flex flex-wrap gap-1">
          {ALL_POLARITIES.map((p) => (
            <button
              key={p}
              onClick={() => {
                onApplyForma(p)
                setPolarityOpen(false)
              }}
              className={cn(
                "hover:bg-accent rounded p-1.5 transition-colors",
                polarity === p && "ring-primary bg-accent ring-1",
              )}
              title={p}
            >
              <PolarityIcon polarity={p} size="sm" />
            </button>
          ))}
          {/* Clear/None option */}
          <button
            onClick={() => {
              // Pass undefined/neutral to clear the forma polarity
              onApplyForma("universal" as Polarity)
              setPolarityOpen(false)
            }}
            className={cn(
              "hover:bg-accent text-muted-foreground rounded p-1.5 text-xs transition-colors",
              !polarity && "ring-primary bg-accent ring-1",
            )}
            title="None (clear polarity)"
          >
            <span className="flex size-4 items-center justify-center">✕</span>
          </button>
        </div>
      </div>
    </PopoverContent>
  )

  // When a mod is present, render with polarity popover
  if (hasMod && modForCard) {
    return (
      <Popover
        open={readOnly ? false : polarityOpen}
        onOpenChange={readOnly ? undefined : setPolarityOpen}
      >
        <PopoverTrigger
          nativeButton={false}
          render={
            <div
              ref={setDroppableRef}
              className={cn(
                "group relative flex items-start justify-center overflow-visible rounded-lg transition-shadow",
                className,
                isOver &&
                  "ring-primary ring-offset-background z-10 ring-2 ring-offset-2",
              )}
              style={{ isolation: "isolate" }}
            />
          }
        >
          <div
            ref={setDraggableRef}
            {...(readOnly ? {} : listeners)}
            {...(readOnly ? {} : attributes)}
            style={style}
            className={cn(
              readOnly
                ? "cursor-default"
                : "cursor-grab active:cursor-grabbing",
              isDragging && "opacity-0",
              transform && "will-change-transform",
            )}
            onClick={(e) => {
              if (readOnly) return
              if (e.shiftKey) {
                setPolarityOpen(true)
              } else {
                onSelect()
              }
            }}
            onContextMenu={(e: React.MouseEvent) => {
              e.preventDefault()
              if (readOnly) return
              setPolarityOpen(false)
              onRemove()
            }}
          >
            <ModCard
              mod={modForCard}
              rank={slot.mod!.rank}
              onRankChange={readOnly ? undefined : onChangeRank}
              setCount={setCount}
              disableHover={isDragging || polarityOpen}
              drainOverride={drain}
              matchState={matchState}
            />
          </div>
          {!readOnly && !isDragging && (
            <button
              type="button"
              className="bg-background/80 text-muted-foreground hover:bg-destructive hover:text-destructive-foreground absolute -top-1.5 -right-1.5 z-10 flex size-5 items-center justify-center rounded-full border transition-opacity group-hover:opacity-100 max-md:opacity-100 md:opacity-0"
              onClick={(e) => {
                e.stopPropagation()
                setPolarityOpen(false)
                onRemove()
              }}
              aria-label="Remove mod"
            >
              <X className="size-3" />
            </button>
          )}
        </PopoverTrigger>
        {!readOnly && polaritySelectorContent}
      </Popover>
    )
  }

  // Empty slot content (shared between tooltip and non-tooltip versions)
  const emptySlotContent = (
    <div
      ref={setDroppableRef}
      className={cn(
        "group relative flex items-center justify-center overflow-visible rounded-lg transition-[box-shadow,background-color]",
        readOnly ? "cursor-default" : "cursor-pointer",
        "bg-card border-border/60 border border-dashed",
        !readOnly && isActive
          ? "ring-primary ring-offset-background ring-2 ring-offset-2"
          : !readOnly && "hover:ring-primary/50 hover:ring-1",
        isOver &&
          "ring-primary ring-offset-background bg-accent/50 ring-2 ring-offset-2",
        className,
      )}
      style={{ isolation: "isolate" }}
      onClick={(e) => {
        if (readOnly) return
        if (e.shiftKey) {
          setPolarityOpen(true)
        } else {
          onSelect()
        }
      }}
      onContextMenu={(e) => {
        e.preventDefault()
        if (readOnly) return
        setPolarityOpen(true)
      }}
    >
      {/* Polarity Icon (Background) */}
      {polarity && (
        <div className="pointer-events-none absolute top-2 right-2 opacity-30">
          <PolarityIcon polarity={polarity} size="sm" />
        </div>
      )}

      {/* Label (Aura/Exilus) */}
      {label && (
        <span className="text-muted-foreground/50 font-mono text-[10px] tracking-wider uppercase">
          {label}
        </span>
      )}

      {!readOnly && (
        <Plus className="text-muted-foreground/20 group-hover:text-muted-foreground/40 size-5 transition-colors" />
      )}
    </div>
  )

  // In read-only mode, just render the slot without tooltip/popover
  if (readOnly) {
    return emptySlotContent
  }

  // Empty slot with polarity selector and tooltip
  return (
    <Popover open={polarityOpen} onOpenChange={setPolarityOpen}>
      <TooltipProvider>
        <Tooltip>
          <PopoverTrigger
            nativeButton={false}
            render={<TooltipTrigger render={emptySlotContent} />}
          />
          <TooltipContent side="bottom">
            <p>Click to add mod</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {polaritySelectorContent}
    </Popover>
  )
})
