import { useEffect, useRef, useState, type ReactNode } from "react"

type Edge = "start" | "middle" | "end" | "none"

const MASK_IMAGES: Record<Exclude<Edge, "none">, string> = {
  start: "linear-gradient(to right, black calc(100% - 24px), transparent)",
  end: "linear-gradient(to right, transparent, black 24px)",
  middle:
    "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)",
}

/**
 * Horizontal scroll wrapper for tab lists that are wider than narrow
 * viewports. Handles:
 *
 *  - edge-to-edge scroll under the page's 16px wrap padding (via `-mx-4`)
 *  - 16px leading/trailing gap inside the scroll area (via an inner `w-max`
 *    box), since `padding-right` on an `overflow-x` wrap isn't counted
 *    in most browsers' scroll-end calculation
 *  - scrolling the active tab into view when `activeKey` changes
 *  - a fade mask on the edge that has hidden content (right when more lives
 *    to the right, left when scrolled past the start, both in the middle)
 */
export function TabScroller({
  activeKey,
  children,
}: {
  activeKey: string
  children: ReactNode
}) {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [edge, setEdge] = useState<Edge>("none")

  useEffect(() => {
    // `aria-selected="true"` is what Base UI's Tabs primitive sets on the
    // active tab; `[data-state="active"]` covers the Radix-style convention
    // in case the underlying primitive swaps. If neither attribute is
    // present (custom children), the scroll-into-view is a no-op.
    const active = wrapperRef.current?.querySelector<HTMLElement>(
      '[aria-selected="true"], [data-state="active"]',
    )
    active?.scrollIntoView({
      inline: "nearest",
      block: "nearest",
      behavior: "smooth",
    })
  }, [activeKey])

  useEffect(() => {
    const el = wrapperRef.current
    if (!el) return
    const update = () => {
      const { scrollLeft, scrollWidth, clientWidth } = el
      const atStart = scrollLeft <= 1
      const atEnd = scrollLeft + clientWidth >= scrollWidth - 1
      if (atStart && atEnd) setEdge("none")
      else if (atStart) setEdge("start")
      else if (atEnd) setEdge("end")
      else setEdge("middle")
    }
    update()
    el.addEventListener("scroll", update, { passive: true })
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => {
      el.removeEventListener("scroll", update)
      ro.disconnect()
    }
  }, [])

  return (
    <div
      ref={wrapperRef}
      className="-mx-4 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      style={edge === "none" ? undefined : { maskImage: MASK_IMAGES[edge] }}
    >
      <div className="w-max px-4">{children}</div>
    </div>
  )
}
