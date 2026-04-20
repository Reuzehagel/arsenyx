import type { Polarity } from "@arsenyx/shared/warframe/types"

import { getPolarityIconUrl } from "@/lib/mod-card-config"
import { cn } from "@/lib/utils"

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
