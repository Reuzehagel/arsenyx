import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type RefObject,
} from "react"

// Shared pointer-drag gesture engine for the build editor. Extracted from
// `drag-controller.tsx` (mod placement) and `ability-stat-reorder.tsx`
// (stat-row reorder), which independently grew identical plumbing:
//
// - One window-scoped pointer listener set, installed once per mount.
// - 4px activation distance — a drag only starts once the pointer moves far
//   enough, so a plain click still falls through to the source's onClick.
// - rAF-coalesced ghost positioning (pointermove can fire 500+/sec on
//   high-Hz devices; we only need one ghost/target update per frame).
// - `elementFromPoint` target resolution under the cursor.
// - Pointer capture deferred to activation (capturing on pointerdown
//   redirects the synthesized click to the wrapper, bypassing inner onClick).
// - Click-swallow listener armed at activation so the trailing `click` from
//   the same pointer sequence doesn't fire the source's onClick.
// - Escape / pointercancel abort.
//
// Callers supply the three pieces that actually differ between the two
// sites: how to find a target at (x, y), what source class to toggle, and
// what to do on a committed drop.

const ACTIVATION_DISTANCE = 4

interface PendingDrag<TSource> {
  source: TSource
  sourceEl: HTMLElement
  startX: number
  startY: number
  pointerId: number
}

interface PointerCapture {
  el: HTMLElement
  pointerId: number
}

export interface UseDragGestureOptions<TSource, TTarget> {
  /** Resolve the drop target under the cursor, or null if none. */
  findTargetAt: (x: number, y: number) => TTarget | null
  /** Commit a completed drop. Called on pointerup with a non-null target. */
  onCommit: (source: TSource, target: TTarget) => void
  /** Class toggled on the source element while a drag is active. */
  sourceClass: string
  /**
   * Equality for targets so a no-op move (target === current) doesn't churn
   * React state. Defaults to `Object.is`. SlotId and numeric-index targets
   * are both primitives, so the default suffices for current callers.
   */
  targetsEqual?: (a: TTarget | null, b: TTarget | null) => boolean
}

export interface UseDragGesture<TSource, TTarget> {
  /** Begin a candidate drag from a pointerdown. No-op for non-primary /
   * touch pointers; activation is deferred to the first qualifying move. */
  startDrag: (source: TSource, e: ReactPointerEvent) => void
  /** The active drag source, or null when no drag is in progress. */
  activeSource: TSource | null
  /** The current drop target under the cursor, or null. */
  target: TTarget | null
  /** Attach to the floating ghost element; positioned via direct DOM
   * `transform` mutation so React doesn't re-render on every tick. */
  ghostRef: RefObject<HTMLDivElement | null>
}

export function useDragGesture<TSource, TTarget>(
  options: UseDragGestureOptions<TSource, TTarget>,
): UseDragGesture<TSource, TTarget> {
  const { findTargetAt, onCommit, sourceClass, targetsEqual } = options

  const [activeSource, setActiveSource] = useState<TSource | null>(null)
  const [target, setTarget] = useState<TTarget | null>(null)

  const activeRef = useRef<TSource | null>(null)
  const targetRef = useRef<TTarget | null>(null)

  // Latest-callback refs so the window listeners (bound once on mount) always
  // see current props without re-binding.
  const findTargetAtRef = useRef(findTargetAt)
  const onCommitRef = useRef(onCommit)
  const sourceClassRef = useRef(sourceClass)
  const targetsEqualRef = useRef(targetsEqual)

  // Sync refs after every render. The refs feed pointer-event listeners
  // attached on drag activation; those listeners always fire after this
  // effect has committed, so they see fresh values without re-binding.
  useEffect(() => {
    activeRef.current = activeSource
    targetRef.current = target
    findTargetAtRef.current = findTargetAt
    onCommitRef.current = onCommit
    sourceClassRef.current = sourceClass
    targetsEqualRef.current = targetsEqual
  })

  const pendingRef = useRef<PendingDrag<TSource> | null>(null)
  const sourceElRef = useRef<HTMLElement | null>(null)
  const ghostRef = useRef<HTMLDivElement | null>(null)
  const captureRef = useRef<PointerCapture | null>(null)
  // Click-swallow listener armed at drag activation so the trailing `click`
  // from the same pointer sequence doesn't fire the source's onClick (which
  // would otherwise also place / open the picker).
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
    // Disarm any still-armed click-swallow after the trailing click has had a
    // chance to fire. Without this the listener leaks if no click follows
    // pointerup (e.g., release over a pointer-events:none element).
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
      sourceElRef.current.classList.remove(sourceClassRef.current)
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

    const sameTarget = (a: TTarget | null, b: TTarget | null) =>
      targetsEqualRef.current ? targetsEqualRef.current(a, b) : Object.is(a, b)

    const positionGhost = (x: number, y: number) => {
      const g = ghostRef.current
      if (!g) return
      // translate3d hints to the compositor; rotate adds the "lifted" tilt so
      // the ghost reads distinctly from anything underneath.
      g.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(-2deg)`
    }

    const flushMove = () => {
      rafId = 0
      pendingMove = false
      if (!activeRef.current) return
      positionGhost(lastX, lastY)
      const next = findTargetAtRef.current(lastX, lastY)
      if (!sameTarget(next, targetRef.current)) {
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
        pending.sourceEl.classList.add(sourceClassRef.current)
        activeRef.current = pending.source
        lastX = e.clientX
        lastY = e.clientY
        const t = findTargetAtRef.current(lastX, lastY)
        targetRef.current = t
        // Take pointer capture only once the drag actually activates.
        // Capturing on pointerdown redirects the synthesized click to the
        // wrapper element, bypassing the inner onClick.
        try {
          pending.sourceEl.setPointerCapture(pending.pointerId)
          captureRef.current = {
            el: pending.sourceEl,
            pointerId: pending.pointerId,
          }
        } catch {
          // Capture is best-effort; window listeners still receive events.
        }
        setActiveSource(pending.source)
        setTarget(t)
        armClickSwallow()
        requestAnimationFrame(() => positionGhost(lastX, lastY))
        return
      }
      if (!activeRef.current) return
      // rAF-coalesce: pointermove can fire 500+/sec on high-Hz devices, but we
      // only need to update ghost position and target once per frame.
      lastX = e.clientX
      lastY = e.clientY
      if (pendingMove) return
      pendingMove = true
      rafId = requestAnimationFrame(flushMove)
    }

    const onPointerUp = () => {
      const a = activeRef.current
      if (a != null) {
        const t = targetRef.current
        if (t != null) onCommitRef.current(a, t)
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

  const startDrag = useCallback((source: TSource, e: ReactPointerEvent) => {
    if (e.button !== 0) return
    // Defer touch — touch-scroll inside the editor needs the gesture for
    // itself. Click-to-place / arrow-key nav still cover touch users.
    if (e.pointerType === "touch") return
    // Don't preventDefault here — doing so on pointerdown suppresses the
    // synthesized click event (per the Pointer Events spec), which breaks
    // click-to-place when the gesture stays under the activation distance.
    pendingRef.current = {
      source,
      sourceEl: e.currentTarget as HTMLElement,
      startX: e.clientX,
      startY: e.clientY,
      pointerId: e.pointerId,
    }
    // Pointer capture is deferred to drag activation (see onPointerMove).
    // Window-level pointermove/pointerup listeners cover the pre-activation
    // window without redirecting the click target.
  }, [])

  return { startDrag, activeSource, target, ghostRef }
}
