// Slug utilities for URL-friendly item names

/**
 * Convert an item name to a URL-friendly slug
 * @example "Excalibur Prime" -> "excalibur-prime"
 * @example "Kuva Bramma" -> "kuva-bramma"
 * @example "MK1-Braton" -> "mk1-braton"
 */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/['']/g, "") // Remove apostrophes
    .replace(/&/g, "and") // Replace & with 'and'
    .replace(/[^a-z0-9]+/g, "-") // Replace non-alphanumeric with hyphens
    .replace(/^-+|-+$/g, "") // Trim leading/trailing hyphens
    .replace(/-+/g, "-") // Collapse multiple hyphens
}
