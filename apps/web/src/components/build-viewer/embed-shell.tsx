import { useEffect, useRef, useState } from "react"

/**
 * Embed wrapper for /builds/$slug?embed=1. Fires postMessage so host pages
 * can auto-resize the iframe to the exact content height. The `bg` param
 * sets body background to blend the embed with the host page.
 *
 * `scale` applies CSS `zoom` globally (e.g. 0.9 = 90%). Because `zoom`
 * affects layout, wrap-query responsive reflow still works — mods wrap
 * at narrow widths just as they do without scaling.
 */
export function EmbedShell({
  scale,
  bg,
  children,
}: {
  scale?: number
  bg?: string
  children: React.ReactNode
}) {
  const innerRef = useRef<HTMLDivElement | null>(null)
  const [innerH, setInnerH] = useState<number | null>(null)
  const zoom = scale ?? 1

  useEffect(() => {
    const inner = innerRef.current
    if (!inner) return
    const ro = new ResizeObserver((entries) => {
      const h = entries[0]?.contentRect.height
      if (typeof h !== "number") return
      const r = Math.ceil(h)
      setInnerH((prev) => (prev === r ? prev : r))
    })
    ro.observe(inner)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (innerH === null) return
    window.parent.postMessage(
      { type: "arsenyx-embed-resize", height: Math.ceil(innerH * zoom) },
      "*",
    )
  }, [innerH, zoom])

  const bgColor = bg ? (bg.startsWith("#") ? bg : `#${bg}`) : undefined

  return (
    <div
      ref={innerRef}
      className="bg-background w-full"
      style={{
        ...(zoom !== 1 && { zoom }),
        ...(bgColor && { backgroundColor: bgColor }),
      }}
    >
      {children}
    </div>
  )
}
