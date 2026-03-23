// Arcane image URL utilities using Warframe Wiki CDN

const WIKI_CDN_BASE = "https://wiki.warframe.com/images"

/**
 * Get the Wiki CDN URL for an arcane image
 * @param arcaneName - The arcane name (e.g., "Arcane Energize")
 * @returns Full Wiki CDN URL or placeholder if no name
 */
export function getArcaneImageUrl(arcaneName?: string): string {
  if (!arcaneName) {
    return getArcanePlaceholderUrl()
  }
  // Remove spaces to match wiki naming convention: "Arcane Energize" -> "ArcaneEnergize"
  const cleanName = arcaneName.replace(/\s+/g, "")
  return `${WIKI_CDN_BASE}/${cleanName}.png`
}

/**
 * Get placeholder image URL for arcanes without images
 */
export function getArcanePlaceholderUrl(): string {
  // Simple gray square with arcane-like diamond shape as SVG data URI
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'%3E%3Crect fill='%231a1a2e' width='128' height='128' rx='8'/%3E%3Cpath d='M64 16 L112 64 L64 112 L16 64 Z' fill='none' stroke='%234a4a6a' stroke-width='2'/%3E%3Ctext x='64' y='72' text-anchor='middle' fill='%236b7280' font-family='system-ui' font-size='24' font-weight='bold'%3E%3F%3C/text%3E%3C/svg%3E"
}
