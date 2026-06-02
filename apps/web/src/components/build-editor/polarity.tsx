import { CANONICAL_POLARITIES } from "@arsenyx/shared/warframe/polarities"
import type { Polarity } from "@arsenyx/shared/warframe/types"
import { X } from "lucide-react"

import { getPolarityIconUrl } from "@/lib/mod-card-config"
import { cn } from "@/lib/util/utils"

/**
 * Polarity glyph, rendered via CSS mask of the SVG asset so we can recolor it.
 * Used on empty slots to stamp the slot's pre-forma polarity.
 */
export function PolarityIcon({
  polarity = "universal",
  className,
  color = "currentColor",
}: {
  polarity?: Polarity
  className?: string
  color?: string
}) {
  // "universal" means "explicitly cleared" — render nothing.
  // "any" is Universal/Omni Forma, which has its own glyph (Any_Pol.svg).
  if (polarity === "universal") return null
  const url = getPolarityIconUrl(polarity)
  return (
    <span
      aria-label={`${polarity} polarity`}
      className={cn("inline-block", className)}
      style={{
        backgroundColor: color,
        maskImage: `url(${url})`,
        maskSize: "contain",
        maskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskImage: `url(${url})`,
        WebkitMaskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
      }}
    />
  )
}

// Picker order mirrors the legacy picker: 7 canonical + "any" (Omni Forma).
// ✕ applies "universal" forma, which explicitly clears the slot.
const PICKER_POLARITIES: Polarity[] = [...CANONICAL_POLARITIES, "any"]

export function PolarityPicker({
  current,
  onPick,
}: {
  /** The slot's current forma polarity, if any — used to highlight the active button. */
  current?: Polarity
  /** Receives a real polarity on pick, or `"universal"` when ✕ is clicked. */
  onPick: (polarity: Polarity) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-muted-foreground text-xs">Select Polarity</span>
      <div className="flex flex-wrap items-center gap-1">
        {PICKER_POLARITIES.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => onPick(p)}
            aria-label={`Apply ${p} polarity`}
            className={cn(
              "hover:bg-muted flex size-6 items-center justify-center rounded transition-colors",
              current === p && "bg-muted ring-primary ring-2",
            )}
          >
            <PolarityIcon polarity={p} className="size-4" />
          </button>
        ))}
        <button
          type="button"
          onClick={() => onPick("universal")}
          aria-label="Clear polarity"
          title="Clear (apply Universal Forma)"
          className={cn(
            "hover:bg-muted text-muted-foreground flex size-6 items-center justify-center rounded transition-colors",
            current === "universal" && "bg-muted ring-primary ring-2",
          )}
        >
          <X className="size-3" />
        </button>
      </div>
    </div>
  )
}
