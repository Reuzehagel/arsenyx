import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react"

import { Kbd } from "@/components/ui/kbd"
import { isMac } from "@/lib/util/platform"

const ARROW_ICONS: Record<
  string,
  React.ComponentType<{ className?: string }>
> = {
  "↑": ArrowUp,
  "↓": ArrowDown,
  "←": ArrowLeft,
  "→": ArrowRight,
}

/**
 * Resolves the `mod` / `shift` tokens in a hotkey label to the platform-correct
 * symbol (⌘ ⇧ on Apple, Ctrl / Shift elsewhere). Anything else is literal.
 */
function platformLabel(label: string): string {
  return label
    .split(" ")
    .map((token) => {
      const t = token.toLowerCase()
      if (t === "mod") return isMac ? "⌘" : "Ctrl"
      if (t === "shift") return isMac ? "⇧" : "Shift"
      return token
    })
    .join(" ")
}

/**
 * Renders a hotkey label inside a `Kbd`. Maps arrow glyphs to lucide icons
 * so directional keys look identical (the Geist `→` glyph renders thinner
 * than the others); everything else falls through as text.
 */
export function KbdKey({ children }: { children: string }) {
  const label = platformLabel(children)
  const Icon = ARROW_ICONS[label]
  return <Kbd>{Icon ? <Icon /> : label}</Kbd>
}
