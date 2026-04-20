import type { Polarity } from "@arsenyx/shared/warframe/types"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

import { PolarityIcon } from "./polarity-icon"

/** The 7 canonical in-game polarities (no "any"/"universal"). */
export const CANONICAL_POLARITIES: readonly Polarity[] = [
  "madurai",
  "vazarin",
  "naramon",
  "zenurik",
  "unairu",
  "penjaga",
  "umbra",
] as const

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
