import { isRivenMod } from "@arsenyx/shared/warframe/rivens"
import type { Mod, Polarity } from "@arsenyx/shared/warframe/types"
import { useQuery } from "@tanstack/react-query"
import { Pencil, Plus, X, type LucideIcon } from "lucide-react"
import {
  useEffect,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react"
import { createPortal } from "react-dom"

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { modTradableQuery } from "@/lib/queries/mod-tradable-query"
import { cn } from "@/lib/util/utils"
import { marketUrl, wikiUrl } from "@/lib/util/warframe-links"

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
import { DetailLinks } from "./item-detail"
import { ModCard } from "./mod-card"
import { PolarityIcon, PolarityPicker } from "./polarity"
import { useRankHover } from "./rank-hover"
import type { SlotId } from "./use-build-slots"

export type ModSlotKind = "normal" | "aura" | "exilus" | "stance"

// Constructed once at module load (browser-only SPA). `.matches` reads live, so
// it still reflects an OS setting the user toggles mid-session — we just avoid
// allocating a fresh MediaQueryList on every drop in every slot.
const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)")

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
  const [pickerOpen, setPickerOpen] = useState(false)
  // View-mode detail: clicking a placed mod pins its expanded card in place
  // (an interactive twin of the desktop hover-preview, so mobile sees the full
  // mod too) with the Wiki/Market links beneath it. Portaled at the slot's
  // viewport center so it escapes the grid's clipping and never spawns a
  // second card below the slot.
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailCenter, setDetailCenter] = useState<{
    x: number
    y: number
  } | null>(null)
  const triggerRef = useRef<HTMLDivElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const rankHover = useRankHover()
  // Drag-and-drop subscriptions. `useIsDropTarget` / `useIsDragSourceSlot`
  // only flip when *this* slot is the over/source slot, so each slot
  // re-renders at most twice per drag (becoming over, leaving over).
  const startDrag = useStartDrag()
  const isOver = useIsDropTarget(slotId)
  const isDragging = useIsDragSourceSlot(slotId)
  const isAnyDragging = useIsAnyDragActive()
  const canDrag = !readOnly && !!mod && !!slotId && kind !== "aura"
  // Drop settle (issue #188), gated for prefers-reduced-motion: a one-shot
  // scale when a mod lands. Driven by a state flag cleared on animationend —
  // deliberately NOT a React `key`. Re-keying the wrapper would remount
  // ModCard, which owns the hover-preview portal; remounting it out from under
  // an open preview orphans that portal (preview stays stuck). The flag flips
  // only when the mod identity changes to a non-empty mod, so it fires on
  // placement/swap but never on initial load or rank-only changes.
  const [settling, setSettling] = useState(false)
  const prevModName = useRef<string | null>(mod?.name ?? null)
  useEffect(() => {
    const name = mod?.name ?? null
    if (name !== prevModName.current) {
      prevModName.current = name
      // Gate the settle at the source: under prefers-reduced-motion the flash
      // overlay's `animation: none` means its `animationend` never fires, so
      // `settling` would latch true forever. Never flip it on instead — no
      // overlay, no scale class, no stuck state.
      setSettling(name != null && !reducedMotionQuery.matches)
    }
  }, [mod?.name])

  const onDragPointerDown = (e: PointerEvent) => {
    if (!canDrag || !startDrag || !mod || !slotId) return
    startDrag({ kind: "slot", slotId, mod, rank }, e)
  }
  // The picker can only be open while this slot is the selected one. Tying
  // open-state to `selected` lets arrow-key nav implicitly close the popover
  // on the previously-clicked slot without a separate close effect.
  const popoverOpen = pickerOpen && !!selected

  // Rank hotkeys are owned by a single listener in editor-shell (hovered ??
  // selected). This slot only advertises itself as the hovered target while
  // the pointer is over it; the owner resolves which one `-`/`+` acts on, so a
  // selected slot and a separately hovered slot can't both rank at once.
  const canRank = !readOnly && !!mod && !!slotId && !!onRankChange

  const handleContextMenu = (e: MouseEvent) => {
    if (readOnly) return
    if (mod && onRemove) {
      e.preventDefault()
      onRemove()
    }
  }

  // Absent when slotId is missing so non-grid uses don't get a stray attr.
  const dropAttr = slotId ? { [DROP_SLOT_ATTR]: slotId } : undefined

  // In view mode the popover surfaces the mod detail (opened by click on a
  // filled slot); in edit mode it's the polarity picker. Keeping the open
  // state branched here means the trigger/content below just switch on
  // `readOnly`.
  const detailEnabled = readOnly && !!mod

  // Compact non-tradable list (deduped across all slots by React Query).
  // Gates the Market link: a mod is tradable unless listed. Rivens carry a stub
  // uniqueName with no Market page, so never link them. Only fetched once a
  // detail is actually opened — not on every filled slot of every build view.
  const { data: nonTradable } = useQuery({
    ...modTradableQuery,
    enabled: detailEnabled && detailOpen,
  })
  const marketHref =
    mod &&
    nonTradable &&
    !isRivenMod(mod) &&
    !nonTradable.includes(mod.uniqueName)
      ? marketUrl(mod.name)
      : undefined

  // Shared by the in-slot card and the pinned detail card so the two can't show
  // a different drain / polarity-match for the same mod. Aura & stance slots
  // contribute a bonus rather than draining capacity.
  const cardDrain = mod
    ? kind === "aura" || kind === "stance"
      ? auraBonusForMod(mod, rank, effective)
      : effectiveDrainForMod(mod, rank, effective)
    : undefined
  const cardMatch = mod ? getMatchState(mod.polarity, effective) : undefined

  // Dismiss the pinned detail on outside click / Escape / scroll / resize. The
  // overlay is position:fixed at coords captured on open, so any scroll or
  // viewport resize (orientation change, zoom) would leave it detached from its
  // slot — close it rather than let it float. The trigger is excluded from the
  // outside-click check so a second click on the same slot toggles it shut via
  // onClick instead of being treated as an outside click (which would race).
  useEffect(() => {
    if (!detailOpen) return
    const onPointerDown = (e: globalThis.PointerEvent) => {
      const t = e.target as Node
      if (overlayRef.current?.contains(t) || triggerRef.current?.contains(t)) {
        return
      }
      setDetailOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Stop here so Escape only dismisses the detail, not an enclosing
        // dialog/popover that also listens for it.
        e.stopPropagation()
        setDetailOpen(false)
      }
    }
    const onReflow = () => setDetailOpen(false)
    document.addEventListener("pointerdown", onPointerDown, true)
    document.addEventListener("keydown", onKey)
    window.addEventListener("scroll", onReflow, {
      capture: true,
      passive: true,
    })
    window.addEventListener("resize", onReflow, { passive: true })
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true)
      document.removeEventListener("keydown", onKey)
      window.removeEventListener("scroll", onReflow, true)
      window.removeEventListener("resize", onReflow)
    }
  }, [detailOpen])

  return (
    <div className="relative" {...dropAttr}>
      <Popover open={popoverOpen} onOpenChange={setPickerOpen}>
        <PopoverTrigger
          nativeButton={false}
          // Slots are driven by arrow-key navigation (window-scoped, see
          // use-keyboard-nav.ts), not by Tab traversal. Keeping them out of the
          // tab order avoids the browser focus ring visually enlarging the
          // focused slot relative to its neighbors.
          render={<div ref={triggerRef} tabIndex={-1} />}
          data-build-slot
          onClick={
            detailEnabled
              ? (e) => {
                  // Anchor on the same compact-card element the hover preview
                  // centers on (not the slot box, which is taller and offset
                  // by the hover overhang) so the pinned card lands pixel-for-
                  // pixel where the hover card does.
                  const host = e.currentTarget as HTMLElement
                  const anchor =
                    host.querySelector("[data-mod-compact]") ?? host
                  const r = anchor.getBoundingClientRect()
                  setDetailCenter({
                    x: r.left + r.width / 2,
                    y: r.top + r.height / 2,
                  })
                  setDetailOpen((o) => !o)
                }
              : readOnly
                ? undefined
                : onClick
          }
          onContextMenu={handleContextMenu}
          onPointerDown={canDrag ? onDragPointerDown : undefined}
          // Mod cards contain <img> elements which the browser starts a
          // native drag-and-drop on by default; suppress it so our
          // pointer-based drag controller owns the gesture.
          onDragStart={(e) => e.preventDefault()}
          // Register as the rank-hotkey target on hover. Suppressed during any
          // active drag so the ghost sweeping across slots doesn't reassign the
          // target. No-op when `rankHover` is absent (read-only viewer / embed).
          onMouseEnter={
            canRank && rankHover && !isAnyDragging
              ? () => rankHover.set({ kind: "mod", id: slotId! })
              : undefined
          }
          onMouseLeave={
            canRank && rankHover && !isAnyDragging
              ? () => rankHover.clear({ kind: "mod", id: slotId! })
              : undefined
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
            (!readOnly || detailEnabled) && "cursor-pointer",
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
              {/* No `key` here on purpose — see the `settling` comment above.
                  The scale class is added while `settling` is true; ModCard
                  underneath is never remounted. The flash overlay below owns
                  clearing the flag (it's the longer of the two animations). */}
              <div className={settling ? "animate-drop-settle" : undefined}>
                <ModCard
                  mod={mod}
                  rank={rank}
                  disableHover={popoverOpen || detailOpen || isAnyDragging}
                  drainOverride={cardDrain}
                  matchState={cardMatch}
                  hideDrain={hideDrain}
                />
              </div>
              {/* White wash confirming the drop. Isolated sibling overlay (no
                  children), so its animationend can't be confused with a
                  ModCard child animation. Clears `settling` when it ends. */}
              {settling && (
                <div
                  className="animate-drop-flash pointer-events-none absolute inset-0 z-30 rounded-md bg-white opacity-0"
                  onAnimationEnd={() => setSettling(false)}
                />
              )}
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

      {/* Pinned in-place detail (view mode). Portaled at the slot's viewport
          center — like the hover preview but interactive — so the mod shows in
          its full expanded form (works on mobile, which has no hover) with the
          Wiki/Market links beneath it. No second card spawns below the slot. */}
      {mod &&
        detailOpen &&
        detailCenter &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            ref={overlayRef}
            className="fixed z-50"
            style={{
              top: detailCenter.y,
              left: detailCenter.x,
              // Center only the card on the anchor (matching hover). The links
              // hang below via absolute positioning so they don't shift the
              // card's center.
              transform: "translate(-50%, -50%)",
              filter: "drop-shadow(0 0 20px rgba(0,0,0,0.85))",
            }}
          >
            <ModCard
              mod={mod}
              rank={rank}
              alwaysExpanded
              drainOverride={cardDrain}
              matchState={cardMatch}
              hideDrain={hideDrain}
            />
            <div className="absolute top-full left-1/2 mt-2 w-max -translate-x-1/2">
              <DetailLinks
                wikiHref={wikiUrl(mod.name)}
                marketHref={marketHref}
              />
            </div>
          </div>,
          document.body,
        )}
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
