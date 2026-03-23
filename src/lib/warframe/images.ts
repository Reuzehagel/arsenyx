// Image URL utilities for Warframe items

const WFCD_CDN_BASE = "https://cdn.warframestat.us/img"

/**
 * Get the CDN URL for an item image
 * @param imageName - The image filename from item.imageName
 * @returns Full CDN URL or placeholder if no image
 */
export function getImageUrl(imageName?: string): string {
  if (!imageName) {
    return getPlaceholderUrl()
  }
  return `${WFCD_CDN_BASE}/${imageName}`
}

/**
 * Get placeholder image URL for items without images
 * Using a data URI for a simple placeholder to avoid 404s
 */
export function getPlaceholderUrl(): string {
  // Simple gray square with question mark as SVG data URI
  return "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'%3E%3Crect fill='%23374151' width='128' height='128' rx='8'/%3E%3Ctext x='64' y='72' text-anchor='middle' fill='%236b7280' font-family='system-ui' font-size='48' font-weight='bold'%3E%3F%3C/text%3E%3C/svg%3E"
}

/**
 * Get optimized image props for Next.js Image component
 */
export function getImageProps(imageName?: string) {
  const src = getImageUrl(imageName)
  const isPlaceholder = !imageName

  return {
    src,
    // WFCD images are typically 128x128 or 256x256
    width: 128,
    height: 128,
    // Use unoptimized for external CDN images
    unoptimized: !isPlaceholder,
  }
}

/**
 * Preload critical images (e.g., for above-the-fold items)
 */
export function getPreloadImageUrl(imageName?: string): string | null {
  if (!imageName) return null
  return getImageUrl(imageName)
}
