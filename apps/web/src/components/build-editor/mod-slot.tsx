import { isRivenMod } from "@arsenyx/shared/warframe/rivens"
import type { Mod, Polarity } from "@arsenyx/shared/warframe/types"
import { Pencil, Plus, X, type LucideIcon } from "lucide-react"
import { useState, type MouseEvent, type PointerEvent } from "react"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn } from "@/lib/utils"

import {
  auraBonusForMod,
  effectiveDrainForMod,
  effectivePolarity,
  getMatchState,
} from "./calculations"
import {
  DROP_SLOT_ATTR,
  useIsAnyDragActive,
  useIsDragSourceSlot,
  useIsDropTarget,
  useStartDrag,
} from "./drag-controller"
import { ModCard } from "./mod-card"
import { PolarityIcon } from "./polarity-icon"
import { PolarityPicker } from "./polarity-picker"
import type { SlotId } from "./use-build-slots"
import { useRankHotkey } from "./use-rank-hotkey"

export type ModSlotKind = "normal" | "aura" | "exilus" | "stance"

interface ModSlotProps {
  kind?: ModSlotKind
  /** Stable identifier for the slot — required for drag-and-drop. */
  slotId?: SlotId
  slotPolarity?: Polarity
  /**
   * Forma polarity. `undefined` → use innate. `"universal"` → explicitly
   * cleared (overrides innate). Any other value stamps that polarity.
   */
  formaPolarity?: Polarity
  mod?: Mod
  rank?: number
  /** Whether this slot is the current placement target. */
  selected?: boolean
  /** LClick: toggle select / open picker (fires for both empty and filled). */
  onClick?: () => void
  /** RClick: remove the placed mod. Only meaningful when `mod` is set. */
  onRemove?: () => void
  /** Apply a polarity (including `"universal"` to clear). */
  onPickPolarity?: (polarity: Polarity) => void
  /** Rank delta from `-` / `=` while the slot is hovered. */
  onRankChange?: (delta: number) => void
  /** Pencil-button handler, only rendered for riven mods. */
  onEditRiven?: () => void
  /** Disables click/hover/remove/picker/rank-hotkey. */
  readOnly?: boolean
  /** Forward to ModCard — suppress the drain badge entirely. Used by
   * Plexus Battle/Tactical slots whose mods don't draw capacity. */
  hideDrain?: boolean
}

const KIND_LABEL: Record<ModSlotKind, string> = {
  normal: "",
  aura: "Aura",
  exilus: "Exilus",
  stance: "Stance",
}

export function ModSlot({
  kind = "normal",
  slotId,
  slotPolarity,
  formaPolarity,
  mod,
  rank = 0,
  selected,
  onClick,
  onRemove,
  onPickPolarity,
  onRankChange,
  onEditRiven,
  readOnly = false,
  hideDrain = false,
}: ModSlotProps) {
  const effective = effectivePolarity(slotPolarity, formaPolarity)
  const [hovered, setHovered] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  // Drag-and-drop subscriptions. `useIsDropTarget` / `useIsDragSourceSlot`
  // only flip when *this* slot is the over/source slot, so each slot
  // re-renders at most twice per drag (becoming over, leaving over).
  const startDrag = useStartDrag()
  const isOver = useIsDropTarget(slotId)
  const isDragging = useIsDragSourceSlot(slotId)
  const isAnyDragging = useIsAnyDragActive()
  const canDrag = !readOnly && !!mod && !!slotId && kind !== "aura"
  const onDragPointerDown = (e: PointerEvent) => {
    if (!canDrag || !startDrag || !mod || !slotId) return
    startDrag({ kind: "slot", slotId, mod, rank }, e)
  }
  // The picker can only be open while this slot is the selected one. Tying
  // open-state to `selected` lets arrow-key nav implicitly close the popover
  // on the previously-clicked slot without a separate close effect.
  const popoverOpen = pickerOpen && !!selected

  // Enable on `selected` too, not just `hovered`: the picker popover steals
  // hover when the user mouses onto it, and a clicked-but-not-hovered slot
  // should still respond to -/+ for ranking down/up.
  useRankHotkey({
    enabled: !readOnly && !!mod && (hovered || !!selected) && !!onRankChange,
    onDelta: (d) => onRankChange?.(d),
  })

  const handleContextMenu = (e: MouseEvent) => {
    if (readOnly) return
    if (mod && onRemove) {
      e.preventDefault()
      onRemove()
    }
  }

  // Absent when slotId is missing so non-grid uses don't get a stray attr.
  const dropAttr = slotId ? { [DROP_SLOT_ATTR]: slotId } : undefined

  return (
    <div className="relative" {...dropAttr}>
      <Popover open={popoverOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger
          nativeButton={false}
          // Slots are driven by arrow-key navigation (window-scoped, see
          // use-keyboard-nav.ts), not by Tab traversal. Keeping them out of the
          // tab order avoids the browser focus ring visually enlarging the
          // focused slot relative to its neighbors.
          render={<div tabIndex={-1} />}
          data-build-slot
          onClick={readOnly ? undefined : onClick}
          onContextMenu={handleContextMenu}
          onPointerDown={canDrag ? onDragPointerDown : undefined}
          // Mod cards contain <img> elements which the browser starts a
          // native drag-and-drop on by default; suppress it so our
          // pointer-based drag controller owns the gesture.
          onDragStart={(e) => e.preventDefault()}
          // Suppress hover state during any active drag — keeps the
          // rank-hotkey enabled flag from flipping (and re-rendering this
          // slot) as the drag ghost sweeps across slots.
          onMouseEnter={
            readOnly || isAnyDragging ? undefined : () => setHovered(true)
          }
          onMouseLeave={
            readOnly || isAnyDragging ? undefined : () => setHovered(false)
          }
          className={cn(
            // Fixed 184×100 to match the underlying ModCard (mod-card-config.ts
            // DISPLAY_SIZE). The grid auto-rearranges its column count based on
            // the loadout wrap width — see mod-grid.tsx — so individual
            // slots stay a constant size and never need to shrink.
            "group relative flex h-[100px] w-[184px] flex-col items-center justify-center transition-colors",
            // `selected` is the single source of visual truth; suppress the
            // default focus ring so a clicked-then-arrowed-away slot doesn't
            // keep highlighting alongside the new selection.
            "outline-none",
            !readOnly && "cursor-pointer",
            // Filled, draggable slots advertise grab affordance; the drag
            // overlay takes over once a real drag starts.
            !readOnly &&
              mod &&
              kind !== "aura" &&
              (isDragging ? "cursor-grabbing" : "cursor-grab"),
            (!mod || isDragging) && "rounded-md border",
            (!mod || isDragging) &&
              !readOnly &&
              (selected && !isDragging
                ? "border-solid border-white/70"
                : "border-muted-foreground/10 hover:border-muted-foreground/25 border-dashed"),
            !mod && readOnly && "border-muted-foreground/10 border-dashed",
            mod &&
              !isDragging &&
              selected &&
              !readOnly &&
              "rounded-md ring-2 ring-white/60",
            // While this slot is the drag source, hide the mod card behind
            // a dashed "ghost" so it reads as a vacated slot (matches how
            // an empty slot looks). The drag overlay carries the real card.
            isOver &&
              !isDragging &&
              "ring-dashed rounded-md ring-2 ring-white/60",
          )}
        >
          {mod && !isDragging ? (
            <>
              <ModCard
                mod={mod}
                rank={rank}
                disableHover={popoverOpen || isAnyDragging}
                drainOverride={
                  kind === "aura" || kind === "stance"
                    ? auraBonusForMod(mod, rank, effective)
                    : effectiveDrainForMod(mod, rank, effective)
                }
                matchState={getMatchState(mod.polarity, effective)}
                hideDrain={hideDrain}
              />
              {!readOnly && (onRemove || (isRivenMod(mod) && onEditRiven)) && (
                // Mobile: always visible (no hover). Desktop: appear on slot
                // hover via CSS group-hover (parent has `group`) so we don't
                // re-render the slot for a purely visual transition.
                <div className="absolute -top-2 -right-2 z-30 flex flex-col gap-1 md:opacity-0 md:transition-opacity md:group-hover:opacity-100">
                  {onRemove && (
                    <SlotIconButton
                      icon={X}
                      label="Remove mod"
                      onClick={onRemove}
                    />
                  )}
                  {isRivenMod(mod) && onEditRiven && (
                    <SlotIconButton
                      icon={Pencil}
                      label="Edit riven stats"
                      onClick={onEditRiven}
                    />
                  )}
                </div>
              )}
            </>
          ) : (
            <>
              {effective && (
                <PolarityIcon
                  polarity={effective}
                  className="absolute top-2 right-2 size-4 opacity-20"
                />
              )}
              <Plus className="text-muted-foreground/15 group-hover:text-muted-foreground/30 size-5 transition-colors" />
              {KIND_LABEL[kind] && (
                <span className="text-muted-foreground/30 mt-1 font-mono text-[10px] tracking-wide uppercase">
                  {KIND_LABEL[kind]}
                </span>
              )}
            </>
          )}
        </PopoverTrigger>
        {!readOnly && onPickPolarity && (
          <PopoverContent className="w-auto">
            <PolarityPicker
              current={formaPolarity}
              onPick={(p) => {
                onPickPolarity(p)
                setPickerOpen(false)
              }}
            />
          </PopoverContent>
        )}
      </Popover>
    </div>
  )
}

function SlotIconButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onPointerDown={(e) => {
        // Stop the slot wrapper's pointerdown from arming a drag when
        // the user is pressing the remove / edit-riven button.
        e.stopPropagation()
      }}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="bg-background/80 text-muted-foreground hover:bg-accent hover:text-accent-foreground flex size-5 items-center justify-center rounded-full border"
    >
      <Icon className="size-3" />
    </button>
  )
}
