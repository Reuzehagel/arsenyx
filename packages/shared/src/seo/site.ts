// Site identity and per-page head meta, shared by the three places that emit
// it: the client route heads (apps/web/src/lib/seo.ts), the edge Worker
// (apps/web/worker/index.ts) and the build-time sitemap (apps/web/vite.config.ts).
// A JS-rendering crawler sees both head layers, so they must emit identical
// values — deriving them from this one module makes drift impossible.

// Import-free on purpose: vite.config.ts loads it through Node's native TS
// support, which can't resolve this package's extensionless imports.

/** Canonical origin. The Worker 301s the apex host onto it. */
export const SITE_URL = "https://www.arsenyx.com"
export const API_ORIGIN = "https://api.arsenyx.com"
export const SITE_NAME = "Arsenyx"
export const DEFAULT_TITLE = `${SITE_NAME} — Warframe Build Planner`
export const DEFAULT_DESCRIPTION =
  "Open-source Warframe build planner. Fast, keyboard-first, and community-driven."

// Copy of warframe/image-hosts.ts IMAGE_CDN (import-free, see above);
// site.test.ts pins them equal.
const IMAGE_CDN = "https://img.arsenyx.com/"

/** Final `<title>`: a page title gets the " — Arsenyx" suffix; none means the
 *  site default. */
export function pageTitle(title?: string): string {
  return title ? `${title} — ${SITE_NAME}` : DEFAULT_TITLE
}

/** Collapse all whitespace (incl. newlines/tabs) to single spaces. Authored
 *  names and guide summaries can contain literal newlines, which some unfurl
 *  scrapers split on when reading a `content="…"` attribute. */
export function collapseWhitespace(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

/** Truncate to `max` code points with an ellipsis. Counts code points, not
 *  UTF-16 units, so a surrogate pair (emoji, supplementary CJK) is never split
 *  into a lone surrogate — some unfurl clients render that as U+FFFD. */
export function clampCodePoints(s: string, max: number): string {
  const chars = Array.from(s)
  if (chars.length <= max) return s
  return `${chars
    .slice(0, max - 1)
    .join("")
    .trimEnd()}…`
}

/** Absolutize an image for og:image. Current catalog data ships absolute
 *  `https://img.arsenyx.com/…` URLs (scripts/sync-images.ts); legacy saved
 *  builds may carry a bare filename, which crawlers can't resolve, so it is
 *  resolved against our own CDN root. */
export function absoluteImage(
  image: string | null | undefined,
): string | undefined {
  if (!image) return undefined
  if (/^https?:\/\//i.test(image)) return image
  try {
    return new URL(image.replace(/^\/+/, ""), IMAGE_CDN).toString()
  } catch {
    return undefined
  }
}

/** `?embed=` truthiness shared by the SPA's `validateSearch` and the Worker,
 *  so both agree on what counts as an embed request. */
export function isEmbedParam(v: unknown): boolean {
  return v === true || v === "1" || v === "true"
}

/** Static `/builds/<segment>` routes, which are not build slugs.
 *  apps/web/worker/index.test.ts pins this against the route tree. */
export const RESERVED_BUILD_SUBPATHS = new Set(["mine"])

// Real slugs are nanoid(10) from a 56-char alphabet; 64 is a generous
// upper bound that still cheaply rejects amplification attempts that try to
// pin Postgres findUnique with megabyte-sized strings.
export const MAX_SLUG_LENGTH = 64

/** The build slug of a `/builds/<slug>[/…]` page path, or null. The Worker's
 *  build-page router and vite.config's dev embed rewrite both match with it. */
export function extractBuildSlug(pathname: string): string | null {
  if (!pathname.startsWith("/builds/")) return null
  const rest = pathname.slice("/builds/".length)
  const slug = rest.split("/")[0]
  if (!slug || slug.length > MAX_SLUG_LENGTH) return null
  if (RESERVED_BUILD_SUBPATHS.has(slug)) return null
  return slug
}

/** Site-relative path of an item detail page. */
export function getItemUrl(category: string, slug: string): string {
  return `/browse/${category}/${slug}`
}

export interface PageMeta {
  /** Title without the site suffix; absent = the site default title. */
  title?: string
  /** Absent = DEFAULT_DESCRIPTION. */
  description?: string
  /** Tool/account pages kept out of the index (robots.txt must not block
   *  them, or the crawler never sees the noindex). */
  noindex?: boolean
}

/** Static pages by path. Indexable entries are self-canonical and listed in
 *  the sitemap; noindex entries are not. */
export const PAGE_META = {
  "/": {},
  "/builds": {
    title: "Community Builds",
    description:
      "Browse community-made Warframe builds — filter by frame, weapon, and category, and share your own.",
  },
  "/orgs": {
    title: "Organizations",
    description:
      "Warframe clans and communities publishing builds together on Arsenyx.",
  },
  "/users": {
    title: "Profiles",
    description:
      "Find Warframe build authors on Arsenyx — search profiles by name or username.",
  },
  "/about": {
    title: "About",
    description:
      "What Arsenyx is, who builds it, and why it's open source. A fast, community-driven Warframe build planner.",
  },
  "/docs": {
    title: "Docs",
    description:
      "Documentation for Arsenyx — embedding builds, the public API, and integrating with the Warframe build planner.",
  },
  "/docs/api": {
    title: "API Reference",
    description:
      "Public API reference for Arsenyx — endpoints for builds, items, and embeds.",
  },
  "/changelog": {
    title: "Changelog",
    description:
      "What's new on Arsenyx — features, fixes, and improvements to the Warframe build planner.",
  },
  "/privacy": { title: "Privacy Policy" },
  "/terms": { title: "Terms of Service" },
  "/admin": { title: "Admin", noindex: true },
  "/create": { title: "Build Editor", noindex: true },
  "/import": { title: "Import Builds", noindex: true },
  "/bookmarks": { title: "Bookmarks", noindex: true },
  "/builds/mine": { title: "My Builds", noindex: true },
  "/auth/signin": { title: "Sign in", noindex: true },
  "/auth/error": { title: "Sign-in error", noindex: true },
  // Redirects to the signed-in user's profile; never renders a head of its own.
  "/profile": { noindex: true },
} as const satisfies Record<string, PageMeta>

/** `/org/$slug/settings` head; the route's `head` reads it too. */
export const ORG_SETTINGS_META = {
  title: "Organization Settings",
  noindex: true,
} as const satisfies PageMeta

/** Noindexed pages under a dynamic (or unlisted) path, with their head meta.
 *  With PAGE_META's `noindex` flags this is the whole noindex list;
 *  public/robots.txt must not Disallow any of them (a blocked crawl never sees
 *  the noindex). */
export const NOINDEX_PATTERNS: readonly { pattern: RegExp; meta: PageMeta }[] =
  [
    { pattern: /^\/auth\//, meta: { noindex: true } },
    { pattern: /^\/org\/[^/]+\/settings$/, meta: ORG_SETTINGS_META },
  ]

export type PagePath = keyof typeof PAGE_META

export function isPagePath(path: string): path is PagePath {
  return Object.hasOwn(PAGE_META, path)
}

/** Paths the sitemap lists: every indexable static page. */
export const INDEXABLE_PAGE_PATHS = (
  Object.keys(PAGE_META) as PagePath[]
).filter((p) => !(PAGE_META[p] as PageMeta).noindex)
