import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react"
import { createPortal } from "react-dom"

import { cn } from "@/lib/utils"

import type { AbilityStatKey } from "./use-ability-stat-order"

// Self-contained pointer-drag for reordering the four ability stat rows.
// Mirrors the conventions of `drag-controller.tsx` (4px activation, rAF-
// coalesced ghost, elementFromPoint targeting, deferred pointer capture,
// click-swallow at activation) but is not coupled to mods or slots.

const ROW_ATTR = "data-stat-row"
const ROW_INDEX_ATTR = "data-stat-index"
const SOURCE_CLASS = "opacity-30"
const ACTIVATION_DISTANCE = 4

type Pending = {
  sourceKey: AbilityStatKey
  sourceIndex: number
  sourceEl: HTMLElement
  ghostLabel: string
  ghostValue: string
  pointerId: number
  startX: number
  startY: number
}

type Active = {
  sourceKey: AbilityStatKey
  sourceIndex: number
  ghostLabel: string
  ghostValue: string
}

function reorder<T>(arr: readonly T[], from: number, to: number): T[] {
  if (from === to) return arr.slice()
  const next = arr.slice()
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

export function useAbilityStatReorder(
  order: readonly AbilityStatKey[],
  onCommit: (next: AbilityStatKey[]) => void,
) {
  const [active, setActive] = useState<Active | null>(null)
  const [targetIndex, setTargetIndex] = useState<number | null>(null)

  const pendingRef = useRef<Pending | null>(null)
  const activeRef = useRef<Active | null>(null)
  const targetRef = useRef<number | null>(null)
  const orderRef = useRef(order)
  const onCommitRef = useRef(onCommit)
  const sourceElRef = useRef<HTMLElement | null>(null)
  const ghostRef = useRef<HTMLDivElement | null>(null)
  const captureRef = useRef<{ el: HTMLElement; pointerId: number } | null>(null)
  const clickSwallowRef = useRef<((e: MouseEvent) => void) | null>(null)

  useEffect(() => {
    orderRef.current = order
    onCommitRef.current = onCommit
    activeRef.current = active
    targetRef.current = targetIndex
  })

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
        // Capture may have been released by the browser already.
      }
      captureRef.current = null
    }
    activeRef.current = null
    targetRef.current = null
    setActive(null)
    setTargetIndex(null)
  }, [])

  useEffect(() => {
    let rafId = 0
    let lastX = 0
    let lastY = 0
    let pendingMove = false

    const findTargetIndex = (x: number, y: number): number | null => {
      const el = document.elementFromPoint(x, y)
      if (!el) return null
      const row = (el as Element).closest(`[${ROW_ATTR}]`)
      if (!row) return null
      const raw = row.getAttribute(ROW_INDEX_ATTR)
      const i = raw ? Number.parseInt(raw, 10) : Number.NaN
      return Number.isFinite(i) ? i : null
    }

    const positionGhost = (x: number, y: number) => {
      const g = ghostRef.current
      if (!g) return
      g.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -50%) rotate(-2deg)`
    }

    const flushMove = () => {
      rafId = 0
      pendingMove = false
      if (!activeRef.current) return
      positionGhost(lastX, lastY)
      const next = findTargetIndex(lastX, lastY)
      if (next !== targetRef.current) {
        targetRef.current = next
        setTargetIndex(next)
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
        const a: Active = {
          sourceKey: pending.sourceKey,
          sourceIndex: pending.sourceIndex,
          ghostLabel: pending.ghostLabel,
          ghostValue: pending.ghostValue,
        }
        activeRef.current = a
        lastX = e.clientX
        lastY = e.clientY
        const t = findTargetIndex(lastX, lastY)
        targetRef.current = t
        try {
          pending.sourceEl.setPointerCapture(pending.pointerId)
          captureRef.current = {
            el: pending.sourceEl,
            pointerId: pending.pointerId,
          }
        } catch {
          // Capture is best-effort.
        }
        setActive(a)
        if (targetRef.current !== t) setTargetIndex(t)
        armClickSwallow()
        requestAnimationFrame(() => positionGhost(lastX, lastY))
        return
      }
      if (!activeRef.current) return
      lastX = e.clientX
      lastY = e.clientY
      if (pendingMove) return
      pendingMove = true
      rafId = requestAnimationFrame(flushMove)
    }

    const onPointerUp = () => {
      const a = activeRef.current
      const t = targetRef.current
      if (a && t != null && t !== a.sourceIndex) {
        onCommitRef.current(reorder(orderRef.current, a.sourceIndex, t))
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

  const ghost =
    active && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={ghostRef}
            className="bg-popover pointer-events-none fixed top-0 left-0 z-50 rounded px-2 py-0.5 text-xs"
            style={{
              transform: "translate3d(-9999px, -9999px, 0)",
              boxShadow: "0 8px 18px rgba(0,0,0,0.55)",
              willChange: "transform",
            }}
          >
            <div className="flex min-w-[8rem] items-baseline justify-between gap-3">
              <span className="text-muted-foreground">{active.ghostLabel}</span>
              <span className="font-medium tabular-nums">
                {active.ghostValue}
              </span>
            </div>
          </div>,
          document.body,
        )
      : null

  const rowProps = (
    key: AbilityStatKey,
    ghostLabel: string,
    ghostValue: string,
  ) => {
    const index = order.indexOf(key)
    const isTarget =
      active != null &&
      targetIndex != null &&
      targetIndex === index &&
      targetIndex !== active.sourceIndex
    return {
      [ROW_ATTR]: key,
      [ROW_INDEX_ATTR]: index,
      className: cn(
        "cursor-grab select-none",
        isTarget && "ring-primary/40 rounded-sm ring-1",
      ),
      onPointerDown: (e: ReactPointerEvent<HTMLElement>) => {
        if (e.button !== 0) return
        if (e.pointerType === "touch") return
        pendingRef.current = {
          sourceKey: key,
          sourceIndex: index,
          ghostLabel,
          ghostValue,
          sourceEl: e.currentTarget,
          pointerId: e.pointerId,
          startX: e.clientX,
          startY: e.clientY,
        }
      },
      onDragStart: (e: ReactPointerEvent<HTMLElement>) => e.preventDefault(),
    }
  }

  return { ghost, rowProps }
}
