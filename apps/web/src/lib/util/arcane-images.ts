const WIKI_CDN_BASE = "https://wiki.warframe.com/images"

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'%3E%3Crect fill='%231a1a2e' width='128' height='128' rx='8'/%3E%3Cpath d='M64 16 L112 64 L64 112 L16 64 Z' fill='none' stroke='%234a4a6a' stroke-width='2'/%3E%3Ctext x='64' y='72' text-anchor='middle' fill='%236b7280' font-family='system-ui' font-size='24' font-weight='bold'%3E%3F%3C/text%3E%3C/svg%3E"

/** Warframe Wiki CDN URL for an arcane (e.g. "Arcane Energize" → ArcaneEnergize.png). */
export function getArcaneImageUrl(name?: string): string {
  if (!name) return PLACEHOLDER
  return `${WIKI_CDN_BASE}/${name.replace(/\s+/g, "")}.png`
}
