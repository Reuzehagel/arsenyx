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

/**
 * Convert a slug back to a searchable name pattern
 * Note: This is lossy - use for searching, not display
 * @example "excalibur-prime" -> "excalibur prime"
 */
export function unslugify(slug: string): string {
  return slug.replace(/-/g, " ")
}

/**
 * Generate the full browse URL for an item
 */
export function getItemUrl(category: string, slug: string): string {
  return `/browse/${category}/${slug}`
}

/**
 * Parse category from URL and normalize to our format
 */
export function normalizeCategory(category: string): string {
  return category.toLowerCase()
}
