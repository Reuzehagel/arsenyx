// Item-page meta description, shared by the web route head() and the edge
// Worker so both head layers emit the identical string (see apps/web/CLAUDE.md).

const MAX = 160

export function itemMetaDescription(
  item: { name: string; description?: string | null },
  categoryLabel: string,
): string {
  if (!item.description)
    return `Plan and share ${item.name} (${categoryLabel}) builds with mods, arcanes, and stats on Arsenyx.`
  const s = `${item.description.replace(/\s+/g, " ").trim()} Plan and share ${item.name} builds on Arsenyx.`
  // Slice by code point so a surrogate pair is never split before the ellipsis.
  const chars = Array.from(s)
  if (chars.length <= MAX) return s
  return `${chars
    .slice(0, MAX - 1)
    .join("")
    .trimEnd()}…`
}
