/* PROTOTYPE — issue #331. Floating variant switcher. Throwaway. */
import { useNavigate } from "@tanstack/react-router"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useEffect } from "react"

import {
  PROTO_VARIANT_LABELS,
  PROTO_VARIANTS,
  type ProtoVariant,
} from "./variants"

function isTyping(el: EventTarget | null): boolean {
  if (!(el instanceof HTMLElement)) return false
  const tag = el.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || el.isContentEditable
}

/**
 * Fixed pill at the bottom of the viewport that cycles `?variant=`. Deliberately
 * high-contrast and un-themed so it never reads as part of the design under
 * evaluation. Dev-only — the caller gates on `import.meta.env.DEV`, and this
 * re-checks so a stray merge can't ship it.
 */
export function PrototypeSwitcher({ current }: { current: ProtoVariant }) {
  const navigate = useNavigate()

  useEffect(() => {
    if (!import.meta.env.DEV) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return
      if (isTyping(document.activeElement)) return
      const i = PROTO_VARIANTS.indexOf(current)
      const next =
        PROTO_VARIANTS[
          (i + (e.key === "ArrowRight" ? 1 : -1) + PROTO_VARIANTS.length) %
            PROTO_VARIANTS.length
        ]
      void navigate({
        to: ".",
        params: true,
        search: (s: Record<string, unknown>) => ({ ...s, variant: next }),
        replace: true,
      })
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [current, navigate])

  if (!import.meta.env.DEV) return null

  const index = PROTO_VARIANTS.indexOf(current)
  const go = (delta: number) => {
    const next =
      PROTO_VARIANTS[
        (index + delta + PROTO_VARIANTS.length) % PROTO_VARIANTS.length
      ]
    void navigate({
      to: ".",
      params: true,
      search: (s: Record<string, unknown>) => ({ ...s, variant: next }),
      replace: true,
    })
  }

  return (
    <div className="fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-1 rounded-full bg-black px-1.5 py-1.5 font-mono text-xs text-white shadow-lg ring-1 ring-white/20">
      <button
        type="button"
        aria-label="Previous variant"
        onClick={() => go(-1)}
        className="flex size-6 cursor-pointer items-center justify-center rounded-full hover:bg-white/15"
      >
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-52 px-2 text-center tabular-nums">
        #331 · {current} — {PROTO_VARIANT_LABELS[current]}
      </span>
      <button
        type="button"
        aria-label="Next variant"
        onClick={() => go(1)}
        className="flex size-6 cursor-pointer items-center justify-center rounded-full hover:bg-white/15"
      >
        <ChevronRight className="size-4" />
      </button>
    </div>
  )
}
