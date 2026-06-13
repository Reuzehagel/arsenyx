// Per-route <head> management. Routes pass the result of `seo()` to their
// `head` option; `<HeadContent />` in __root.tsx renders the tags. The
// canonical origin is fixed (www) so indexed URLs never split across the
// apex/www duplicate hosts — the Worker 301s apex → www to match.

export const SITE_URL = "https://www.arsenyx.com"
export const SITE_NAME = "Arsenyx"
const IMAGE_CDN = "https://img.arsenyx.com/"

// Absolutize an item image for og:image/twitter:image. Current catalog data
// ships absolute https://img.arsenyx.com/… URLs, but denormalized/legacy values
// (e.g. a build's stored item.imageName) may be bare filenames, which crawlers
// can't resolve against a relative og:image. Pass http(s) URLs through; prepend
// the CDN root for bare names. Mirrors the edge Worker's imageUrl()
// (worker/index.ts) so the server- and client-rendered cards match. Lives here
// so every seo() caller is defended by one implementation.
function absoluteImage(image: string | undefined): string | undefined {
  if (!image) return undefined
  if (/^https?:\/\//i.test(image)) return image
  try {
    return new URL(image.replace(/^\/+/, ""), IMAGE_CDN).toString()
  } catch {
    return undefined
  }
}

export const DEFAULT_TITLE = "Arsenyx — Warframe Build Planner"
export const DEFAULT_DESCRIPTION =
  "Open-source Warframe build planner. Fast, keyboard-first, and community-driven."

type AnyMeta = Record<string, string | undefined>

export interface SeoOptions {
  /** Page title without the site suffix; `seo()` appends " — Arsenyx". */
  title?: string
  description?: string
  /** Site-relative canonical path incl. leading slash (e.g. "/browse").
   *  May include a query string for pages whose identity lives in search
   *  params (e.g. "/browse?category=melee"). Omit to skip the canonical. */
  canonicalPath?: string
  /** og:image: an absolute URL or a bare CDN filename; `seo()` absolutizes it
   *  against the image CDN, so callers may pass a raw `item.imageName`. */
  image?: string
  /** Auth/editor/user-private pages that should stay out of the index. */
  noindex?: boolean
  /** og:type. Defaults to "website". Must match what the edge Worker injects
   *  for the same URL (worker/index.ts buildMeta emits "article" for public
   *  build pages) — a mismatch leaves two conflicting og:type tags in the
   *  hydrated head, and og's "first tag wins" can pick the wrong one. */
  ogType?: string
  /** JSON-LD payload, rendered as <script type="application/ld+json">. */
  jsonLd?: object
}

export function seo(opts: SeoOptions = {}) {
  const title = opts.title ? `${opts.title} — ${SITE_NAME}` : DEFAULT_TITLE
  const description = opts.description ?? DEFAULT_DESCRIPTION
  const canonical = opts.canonicalPath
    ? `${SITE_URL}${opts.canonicalPath}`
    : undefined

  const meta: AnyMeta[] = [
    { title },
    { name: "description", content: description },
    { property: "og:site_name", content: SITE_NAME },
    { property: "og:type", content: opts.ogType ?? "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ]
  if (canonical) meta.push({ property: "og:url", content: canonical })
  const image = absoluteImage(opts.image)
  if (image) {
    meta.push(
      { property: "og:image", content: image },
      { name: "twitter:image", content: image },
    )
  }
  if (opts.noindex) meta.push({ name: "robots", content: "noindex" })
  if (opts.jsonLd) meta.push({ "script:ld+json": opts.jsonLd } as never)

  return {
    meta,
    links: canonical ? [{ rel: "canonical", href: canonical }] : [],
  }
}
