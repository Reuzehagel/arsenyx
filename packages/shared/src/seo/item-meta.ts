// Item-page meta description, shared by the web route head() and the edge
// Worker so both head layers emit the identical string (see apps/web/CLAUDE.md).

import { clampCodePoints, collapseWhitespace } from "./site"

const MAX = 160

/** Item detail page title, without the site suffix. */
export function itemMetaTitle(name: string): string {
  return `${name} Builds`
}

export function itemMetaDescription(
  item: { name: string; description?: string | null },
  categoryLabel: string,
): string {
  if (!item.description)
    return `Plan and share ${item.name} (${categoryLabel}) builds with mods, arcanes, and stats on Arsenyx.`
  return clampCodePoints(
    `${collapseWhitespace(item.description)} Plan and share ${item.name} builds on Arsenyx.`,
    MAX,
  )
}
