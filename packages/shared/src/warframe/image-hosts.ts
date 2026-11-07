// Where catalog images may live. The pipeline mirrors every upstream URL into
// our R2 bucket (scripts/sync-images.ts), and the web app only renders
// absolute image URLs under these prefixes (apps/web/src/lib/image-url.ts).

/** Our R2-backed image CDN — what the committed catalog points at. */
export const IMAGE_CDN = "https://img.arsenyx.com/"

/** Upstream image hosts the pipeline mirrors, each with the path prefix its
 *  images live under. */
export const UPSTREAM_IMAGE_HOSTS = {
  "content.warframe.com": "/PublicExport/",
  "wiki.warframe.com": "/images/",
} as const

export type UpstreamImageHost = keyof typeof UPSTREAM_IMAGE_HOSTS
