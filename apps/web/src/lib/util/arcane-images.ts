import { getImageUrl } from "@/lib/warframe"

const PLACEHOLDER =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'%3E%3Crect fill='%231a1a2e' width='128' height='128' rx='8'/%3E%3Cpath d='M64 16 L112 64 L64 112 L16 64 Z' fill='none' stroke='%234a4a6a' stroke-width='2'/%3E%3Ctext x='64' y='72' text-anchor='middle' fill='%236b7280' font-family='system-ui' font-size='24' font-weight='bold'%3E%3F%3C/text%3E%3C/svg%3E"

/** Resolve an arcane's icon URL.
 *
 *  The catalog (`arcanes-all.json`) ships an absolute `imageName` that
 *  points at our R2 CDN — emitted by `scripts/sync-images.ts`. Prefer
 *  that when available, otherwise fall back to the placeholder. We used
 *  to derive a wiki URL from the arcane name here, but that bypassed
 *  R2 and left us serving from `wiki.warframe.com` at runtime. */
export function getArcaneImageUrl(imageName?: string): string {
  if (!imageName) return PLACEHOLDER
  const url = getImageUrl(imageName)
  // `getImageUrl` returns a placeholder for anything outside the trusted
  // host allowlist; surface our own placeholder so the caller doesn't
  // render a different SVG depending on which arcane lacks an icon.
  if (url.startsWith("data:")) return PLACEHOLDER
  return url
}
