import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp } from "lucide-react"

import { Kbd } from "@/components/ui/kbd"

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
 * Renders a hotkey label inside a `Kbd`. Maps arrow glyphs to lucide icons
 * so directional keys look identical (the Geist `→` glyph renders thinner
 * than the others); everything else falls through as text.
 */
export function KbdKey({ children }: { children: string }) {
  const Icon = ARROW_ICONS[children]
  return <Kbd>{Icon ? <Icon /> : children}</Kbd>
}
