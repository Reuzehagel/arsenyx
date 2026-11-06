import {
  IMAGE_CDN,
  UPSTREAM_IMAGE_HOSTS,
} from "@arsenyx/shared/warframe/image-hosts"

const PLACEHOLDER_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'%3E%3Crect fill='%23374151' width='128' height='128' rx='8'/%3E%3Ctext x='64' y='72' text-anchor='middle' fill='%236b7280' font-family='system-ui' font-size='48' font-weight='bold'%3E%3F%3C/text%3E%3C/svg%3E"

/** Prefixes the catalog may emit absolute image URLs under: our CDN, plus
 *  the upstream hosts so a dev workflow that ran `build:items` without
 *  `sync:images` still renders. Anything else falls through to the
 *  placeholder, so an attacker-controlled value can't reach `<img src>`. */
const TRUSTED_IMAGE_PREFIXES = [
  IMAGE_CDN,
  ...Object.entries(UPSTREAM_IMAGE_HOSTS).map(
    ([host, path]) => `https://${host}${path}`,
  ),
]

/** Arcanes' placeholder: a diamond, so a missing arcane icon reads as one. */
export const ARCANE_PLACEHOLDER_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='128' height='128' viewBox='0 0 128 128'%3E%3Crect fill='%231a1a2e' width='128' height='128' rx='8'/%3E%3Cpath d='M64 16 L112 64 L64 112 L16 64 Z' fill='none' stroke='%234a4a6a' stroke-width='2'/%3E%3Ctext x='64' y='72' text-anchor='middle' fill='%236b7280' font-family='system-ui' font-size='24' font-weight='bold'%3E%3F%3C/text%3E%3C/svg%3E"

export function getImageUrl(
  imageName?: string,
  placeholder = PLACEHOLDER_URL,
): string {
  if (!imageName) return placeholder
  // Locally-hosted icons live under `/img/`.
  if (imageName.startsWith("/img/")) return imageName
  return TRUSTED_IMAGE_PREFIXES.some((p) => imageName.startsWith(p))
    ? imageName
    : placeholder
}
