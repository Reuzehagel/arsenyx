// Per-route <head> management. Routes pass the result of `seo()` to their
// `head` option; `<HeadContent />` in __root.tsx renders the tags. The
// canonical origin is fixed (www) so indexed URLs never split across the
// apex/www duplicate hosts — the Worker 301s apex → www to match.

export const SITE_URL = "https://www.arsenyx.com"
export const SITE_NAME = "Arsenyx"

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
  /** Absolute URL for og:image. */
  image?: string
  /** Auth/editor/user-private pages that should stay out of the index. */
  noindex?: boolean
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
    { property: "og:type", content: "website" },
    { property: "og:title", content: title },
    { property: "og:description", content: description },
    { name: "twitter:card", content: "summary" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: description },
  ]
  if (canonical) meta.push({ property: "og:url", content: canonical })
  if (opts.image) {
    meta.push(
      { property: "og:image", content: opts.image },
      { name: "twitter:image", content: opts.image },
    )
  }
  if (opts.noindex) meta.push({ name: "robots", content: "noindex" })
  if (opts.jsonLd) meta.push({ "script:ld+json": opts.jsonLd } as never)

  return {
    meta,
    links: canonical ? [{ rel: "canonical", href: canonical }] : [],
  }
}
