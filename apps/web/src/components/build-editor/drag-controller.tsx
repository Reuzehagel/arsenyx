import type { Mod } from "@arsenyx/shared/warframe/types"
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type RefObject,
} from "react"
import { createPortal } from "react-dom"

import { ModCard } from "./mod-card"
import {
  canPlaceIn,
  type BuildSlotsState,
  type SlotId,
} from "./use-build-slots"

// Custom drag layer for the build editor. Replaces @dnd-kit because that
// library's `useDraggable` subscribes every draggable to a single React
// context — with ~200 mod cards in the pool, every slot-transition during
// a drag forced all 200 to re-render. Memo can't help (context bypasses
// memo), so we own the pointer plumbing ourselves.
//
// Design:
// - One window-scoped pointer listener set, installed once.
// - Source elements register only an `onPointerDown` handler; they never
//   subscribe to drag state, so they don't re-render mid-drag.
// - Slots subscribe to two narrow contexts (`isOver`, `isSource`) — at
//   most ~10 consumers, recommit on slot-boundary crossings is cheap.
// - The floating ghost element moves via direct DOM `transform` mutation
//   in the pointermove handler, so React doesn't re-render on every tick.
// - Drop target is the slot under the cursor (`elementFromPoint`), which
//   fixes the off-by-one selection from dnd-kit's rect-intersection
//   strategy.

const SLOT_DATA_ATTR = "data-drop-slot-id"
const SOURCE_CLASS = "is-drag-source"
const ACTIVATION_DISTANCE = 4

type Source =
  | { kind: "pool"; mod: Mod }
  | { kind: "slot"; slotId: SlotId; mod: Mod; rank: number }

type StartFn = (source: Source, e: ReactPointerEvent) => void

const StartContext = createContext<StartFn | null>(null)
const TargetContext = createContext<SlotId | null>(null)
const SourceSlotContext = createContext<SlotId | null>(null)
const DraggingContext = createContext<boolean>(false)

interface PendingDrag {
  source: Source
  sourceEl: HTMLElement
  startX: number
  startY: number
  pointerId: number
}

interface PointerCapture {
  el: HTMLElement
  pointerId: number
}

export function DragController({
  slots,
  children,
}: {
  slots: BuildSlotsState
  children: ReactNode
}) {
  // Latest-slots ref so the drop handler doesn't re-bind window listeners
  // every render.
  const slotsRef = useRef(slots)
  slotsRef.current = slots

  const [activeSource, setActiveSource] = useState<Source | null>(null)
  const [target, setTarget] = useState<SlotId | null>(null)

  const activeRef = useRef<Source | null>(null)
  activeRef.current = activeSource
  const targetRef = useRef<SlotId | null>(null)
  targetRef.current = target

  const pendingRef = useRef<PendingDrag | null>(null)
  const sourceElRef = useRef<HTMLElement | null>(null)
  const ghostRef = useRef<HTMLDivElement | null>(null)
  const captureRef = useRef<PointerCapture | null>(null)
  // Click-swallow listener armed at drag activation so the trailing
  // `click` from the same pointer sequence doesn't fire the source's
  // onClick (which would otherwise also place / open the picker).
  const clickSwallowRef = useRef<((e: MouseEvent) => void) | null>(null)

  const armClickSwallow = useCallback(() => {
    if (clickSwallowRef.current) return
    const fn = (e: MouseEvent) => {
      e.stopPropagation()
      e.preventDefault()
      document.removeEventListener("click", fn, true)
      clickSwallowRef.current = null
    }
    clickSwallowRef.current = fn
    document.addEventListener("click", fn, true)
  }, [])

  const disarmClickSwallow = useCallback(() => {
    if (!clickSwallowRef.current) return
    document.removeEventListener("click", clickSwallowRef.current, true)
    clickSwallowRef.current = null
  }, [])

  const cleanup = useCallback(() => {
    pendingRef.current = null
    // Disarm any still-armed click-swallow after the trailing click has
    // had a chance to fire. Without this the listener leaks if no click
    // follows pointerup (e.g., release over a pointer-events:none element).
    if (clickSwallowRef.current) {
      const fn = clickSwallowRef.current
      setTimeout(() => {
        if (clickSwallowRef.current === fn) {
          document.removeEventListener("click", fn, true)
          clickSwallowRef.current = null
        }
      }, 0)
    }
    if (sourceElRef.current) {
      sourceElRef.current.classList.remove(SOURCE_CLASS)
      sourceElRef.current = null
    }
    if (captureRef.current) {
      const { el, pointerId } = captureRef.current
      try {
        if (el.hasPointerCapture(pointerId)) {
          el.releasePointerCapture(pointerId)
        }
      } catch {
        // No-op: capture may have been released by the browser already.
      }
      captureRef.current = null
    }
    activeRef.current = null
    targetRef.current = null
    setActiveSource(null)
    setTarget(null)
  }, [])

  useEffect(() => {
    let rafId = 0
    let lastX = 0
    let lastY = 0
    let pendingMove = false

    const findSlotAt = (x: number, y: number): SlotId | null => {
      const el = document.elementFromPoint(x, y)
      if (!el) return null
      const slot = (el as Element).closest(`[${SLOT_DATA_ATTR}]`)
      return slot
        ? ((slot.getAttribute(SLOT_DATA_ATTR) ?? null) as SlotId | null)
        : null
    }

    const positionGhost = (x: number, y: number) => {
      const g = ghostRef.current
      if (!g) return
      // translate3d hints to the compositor; rotate adds the "lifted"
      // tilt so the ghost reads distinctly from anything underneath.
      g.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(-2deg)`
    }

    const flushMove = () => {
      rafId = 0
      pendingMove = false
      if (!activeRef.current) return
      positionGhost(lastX, lastY)
      const next = findSlotAt(lastX, lastY)
      if (next !== targetRef.current) {
        targetRef.current = next
        setTarget(next)
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      const pending = pendingRef.current
      if (pending && !activeRef.current) {
        if (pending.pointerId !== e.pointerId) return
        const dx = e.clientX - pending.startX
        const dy = e.clientY - pending.startY
        if (dx * dx + dy * dy < ACTIVATION_DISTANCE * ACTIVATION_DISTANCE) {
          return
        }
        sourceElRef.current = pending.sourceEl
        pending.sourceEl.classList.add(SOURCE_CLASS)
        activeRef.current = pending.source
        const t = findSlotAt(e.clientX, e.clientY)
        targetRef.current = t
        lastX = e.clientX
        lastY = e.clientY
        setActiveSource(pending.source)
        setTarget(t)
        armClickSwallow()
        requestAnimationFrame(() => positionGhost(lastX, lastY))
        return
      }
      if (!activeRef.current) return
      // rAF-coalesce: pointermove can fire 500+/sec on high-Hz devices, but
      // we only need to update ghost position and target slot once per frame.
      lastX = e.clientX
      lastY = e.clientY
      if (pendingMove) return
      pendingMove = true
      rafId = requestAnimationFrame(flushMove)
    }

    const commitDrop = (source: Source, targetSlot: SlotId) => {
      const s = slotsRef.current
      if (source.kind === "pool") {
        if (!canPlaceIn(source.mod, targetSlot)) return
        const existing = s.placed[targetSlot]
        if (existing?.mod.name === source.mod.name) return
        if (s.usedNames.has(source.mod.name)) return
        s.placeAt(targetSlot, source.mod)
        return
      }
      if (source.slotId === targetSlot) return
      s.swap(source.slotId, targetSlot)
    }

    const onPointerUp = () => {
      const a = activeRef.current
      if (a) {
        const t = targetRef.current
        if (t) commitDrop(a, t)
      }
      cleanup()
    }

    const onPointerCancel = () => {
      disarmClickSwallow()
      cleanup()
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activeRef.current) {
        disarmClickSwallow()
        cleanup()
      }
    }

    window.addEventListener("pointermove", onPointerMove, { passive: true })
    window.addEventListener("pointerup", onPointerUp)
    window.addEventListener("pointercancel", onPointerCancel)
    window.addEventListener("keydown", onKeyDown)
    return () => {
      window.removeEventListener("pointermove", onPointerMove)
      window.removeEventListener("pointerup", onPointerUp)
      window.removeEventListener("pointercancel", onPointerCancel)
      window.removeEventListener("keydown", onKeyDown)
      if (rafId) cancelAnimationFrame(rafId)
    }
  }, [cleanup, armClickSwallow, disarmClickSwallow])

  const startDrag: StartFn = useCallback((source, e) => {
    if (e.button !== 0) return
    // Defer touch — touch-scroll inside the pool grid needs the gesture
    // for itself. Click-to-place / arrow-key nav still cover touch users.
    if (e.pointerType === "touch") return
    // Suppress the browser's native pointerdown side effects: text
    // selection, drag-to-select, and the default image-drag (mod cards
    // contain <img> elements). Without this, a previous selection or
    // image-drag will hijack the gesture and our pointer-based drag
    // never gets clean signals.
    e.preventDefault()
    const el = e.currentTarget as HTMLElement
    pendingRef.current = {
      source,
      sourceEl: el,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
    }
    // Capture so pointerup fires reliably even if the user releases
    // outside the source element or window.
    try {
      el.setPointerCapture(e.pointerId)
      captureRef.current = { el, pointerId: e.pointerId }
    } catch {
      // Capture is best-effort; window listeners still receive events.
    }
  }, [])

  const activeSourceSlot =
    activeSource?.kind === "slot" ? activeSource.slotId : null
  const isAnyDragging = activeSource != null

  return (
    <StartContext.Provider value={startDrag}>
      <DraggingContext.Provider value={isAnyDragging}>
        <SourceSlotContext.Provider value={activeSourceSlot}>
          <TargetContext.Provider value={target}>
            {children}
            {activeSource &&
              typeof document !== "undefined" &&
              createPortal(
                <DragGhost
                  ghostRef={ghostRef}
                  mod={activeSource.mod}
                  rank={
                    activeSource.kind === "slot" ? activeSource.rank : undefined
                  }
                />,
                document.body,
              )}
          </TargetContext.Provider>
        </SourceSlotContext.Provider>
      </DraggingContext.Provider>
    </StartContext.Provider>
  )
}

function DragGhost({
  ghostRef,
  mod,
  rank,
}: {
  ghostRef: RefObject<HTMLDivElement | null>
  mod: Mod
  rank: number | undefined
}) {
  return (
    <div
      ref={ghostRef}
      className="pointer-events-none fixed top-0 left-0 z-50"
      style={{
        // Park off-screen until the first pointermove repositions us; the
        // listener calls `positionGhost` on rAF after mount.
        transform: "translate3d(-9999px, -9999px, 0)",
        boxShadow: "0 8px 18px rgba(0,0,0,0.55)",
        willChange: "transform",
      }}
    >
      <ModCard mod={mod} rank={rank} disableHover />
    </div>
  )
}

/** Returns the slot-id data-attribute key callers should set on droppable wrappers. */
export const DROP_SLOT_ATTR = SLOT_DATA_ATTR

/** Subscribe a source element to drag start. Returns `null` outside a controller. */
export function useStartDrag() {
  return useContext(StartContext)
}

export function useIsDropTarget(slotId: SlotId | undefined): boolean {
  const target = useContext(TargetContext)
  return slotId != null && target === slotId
}

export function useIsDragSourceSlot(slotId: SlotId | undefined): boolean {
  const source = useContext(SourceSlotContext)
  return slotId != null && source === slotId
}

export function useIsAnyDragActive(): boolean {
  return useContext(DraggingContext)
}
