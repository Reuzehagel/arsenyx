// Bundled by wrangler (see wrangler.toml `main`). Runs for every HTML
// navigation (run_worker_first excludes static asset directories) and acts as
// a lightweight edge "SSR head": it 301s the apex host onto the canonical
// www origin and injects per-page <title>/<meta>/<link rel=canonical> into
// the SPA shell so crawlers and unfurl bots get real metadata in the initial
// HTML response — no JS rendering required. Every user agent gets the same
// rewritten HTML (serving it to bots only would be cloaking).
//
// Titles/canonicals/og tags here mirror the client-side route heads
// (src/routes/*.tsx `head` options + src/lib/seo.ts) — keep them in sync. Build
// title/og:type are single-sourced via @arsenyx/shared/seo/build-meta so they
// can't drift. Build og:description intentionally does NOT mirror the client:
// this edge layer enriches it with live like/view stats for unfurls.
//
// Build-page title/author/og:type are derived from the SAME shared module the
// client route uses (@arsenyx/shared/seo/build-meta) so the two head layers
// can't drift. wrangler bundles this import inline (the api Worker imports the
// shared package the same way), so the file stays free of heavy/runtime deps.

import { buildMetaTitle, buildOgType } from "@arsenyx/shared/seo/build-meta"

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

const API_BASE = "https://api.arsenyx.com"
const SITE_URL = "https://www.arsenyx.com"
const SITE_NAME = "Arsenyx"
const DEFAULT_DESCRIPTION =
  "Open-source Warframe build planner. Fast, keyboard-first, and community-driven."

const RESERVED_BUILD_SUBPATHS = new Set(["mine", "bookmarks", "new"])
// Real slugs are nanoid(10) from a 56-char alphabet; 64 is a generous
// upper bound that still cheaply rejects amplification attempts that try to
// pin Postgres findUnique with megabyte-sized strings.
const MAX_SLUG_LENGTH = 64

// Sync with CATEGORIES in src/lib/warframe.ts.
const CATEGORY_LABELS: Record<string, string> = {
  warframes: "Warframes",
  primary: "Primary",
  secondary: "Secondary",
  melee: "Melee",
  companions: "Companions",
  "companion-weapons": "Companion Weapons",
  archwing: "Archwing",
  necramechs: "Necramechs",
  "exalted-weapons": "Exalted",
  railjack: "Railjack",
}

// Sync with the `head` options in src/routes/*.tsx.
const STATIC_META: Record<string, { title: string; description?: string }> = {
  "/": { title: `${SITE_NAME} — Warframe Build Planner` },
  "/builds": {
    title: `Community Builds — ${SITE_NAME}`,
    description:
      "Browse community-made Warframe builds — filter by frame, weapon, and category, and share your own.",
  },
  "/orgs": {
    title: `Organizations — ${SITE_NAME}`,
    description:
      "Warframe clans and communities publishing builds together on Arsenyx.",
  },
  "/about": {
    title: `About — ${SITE_NAME}`,
    description:
      "What Arsenyx is, who builds it, and why it's open source. A fast, community-driven Warframe build planner.",
  },
  "/docs": {
    title: `Docs — ${SITE_NAME}`,
    description:
      "Documentation for Arsenyx — embedding builds, the public API, and integrating with the Warframe build planner.",
  },
  "/docs/api": {
    title: `API Reference — ${SITE_NAME}`,
    description:
      "Public API reference for Arsenyx — endpoints for builds, items, and embeds.",
  },
  "/changelog": {
    title: `Changelog — ${SITE_NAME}`,
    description:
      "What's new on Arsenyx — features, fixes, and improvements to the Warframe build planner.",
  },
  "/privacy": { title: `Privacy Policy — ${SITE_NAME}` },
  "/terms": { title: `Terms of Service — ${SITE_NAME}` },
}

// Tool/account pages: serve a noindex hint in the initial HTML so crawlers
// don't have to render JS to learn it. robots.txt blocks most of these too.
const NOINDEX_PATHS = new Set([
  "/admin",
  "/create",
  "/import",
  "/bookmarks",
  "/builds/mine",
  "/profile",
])

type BuildSummary = {
  name: string
  description: string | null
  visibility: "PUBLIC" | "PRIVATE" | "UNLISTED"
  hideAuthor: boolean
  item: {
    name: string
    category: string
    uniqueName: string
    imageName: string | null
  }
  user: {
    displayUsername: string | null
    username: string | null
    name: string | null
  }
  organization: { name: string } | null
  guide: { summary: string | null } | null
  likeCount: number
  viewCount: number
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method !== "GET") return env.ASSETS.fetch(request)

    // Canonical-host redirect: apex → www. Without it both hosts serve the
    // full site and split ranking signals. Only the exact production apex —
    // localhost / *.workers.dev previews pass through untouched.
    //
    // No Strict-Transport-Security header here: RFC 6797 §7.2 forbids sending
    // it on a response that may have traveled over insecure transport (a plain
    // http://arsenyx.com request that wasn't already upgraded), and browsers
    // ignore it over HTTP anyway. The canonical www response carries HSTS via
    // public/_headers once the browser follows this 301.
    if (url.hostname === "arsenyx.com") {
      const target = new URL(url.pathname + url.search, SITE_URL)
      return new Response(null, {
        status: 301,
        headers: { location: target.toString() },
      })
    }

    const buildSlug = extractBuildSlug(url.pathname)
    if (buildSlug) return handleBuildPage(request, env, url, buildSlug)

    const item = extractItemPath(url.pathname)
    if (item) return handleItemPage(request, env, url, item)

    return handleGenericPage(request, env, url)
  },
}

// ---------------------------------------------------------------------------
// /builds/:slug — build detail pages
// ---------------------------------------------------------------------------

async function handleBuildPage(
  request: Request,
  env: Env,
  url: URL,
  slug: string,
): Promise<Response> {
  // Embed iframes (`?embed=1`) get a dedicated lightweight shell instead of
  // the full SPA index.html, so a guide page with many embeds doesn't boot
  // the whole app once per iframe. embed.html reads the slug from the path
  // (the iframe URL is unchanged), so we just serve its body for this URL.
  //
  // Static Assets' html_handling rewrites `/embed.html` → `/embed` with a
  // redirect (same as `/index.html` → `/`). We must NOT pass that redirect
  // back to the iframe — it would bounce to `/embed` and hit the SPA
  // fallback. So request the clean `/embed` path (served 200) and, defensively,
  // follow a redirect once if the binding still returns one.
  if (isEmbedRequest(url)) {
    let res = await env.ASSETS.fetch(
      new Request(new URL("/embed", url).toString(), request),
    )
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location")
      if (loc) {
        res = await env.ASSETS.fetch(
          new Request(new URL(loc, url).toString(), request),
        )
      }
    }
    return res
  }

  // Workers Static Assets redirects `/index.html` → `/` by default
  // (html_handling), so we ask for the original path and let the SPA
  // fallback (`not_found_handling = "single-page-application"`) serve
  // index.html with a 200. env.ASSETS.fetch returns an asset-server response
  // and does not re-invoke this Worker, so there's no recursion here.
  const [shellRes, build] = await Promise.all([
    env.ASSETS.fetch(request),
    fetchBuild(slug),
  ])

  const contentType = shellRes.headers.get("content-type") ?? ""
  if (!shellRes.ok || !contentType.includes("text/html")) return shellRes

  // Dead link: keep the shell (the SPA renders its not-found page) but send a
  // real 404 status so search engines drop the URL instead of indexing a
  // soft-404. Owners viewing their own PRIVATE build also land here (the
  // anonymous API call can't see it) — the SPA still renders it fine; the
  // status code only matters to crawlers.
  if (build === "not-found") {
    return rewriteMeta(
      new Response(shellRes.body, { status: 404, headers: shellRes.headers }),
      { noindex: true },
    )
  }
  // API error/timeout: shell with default meta.
  if (!build) return rewriteMeta(shellRes, {})

  // Only enrich PUBLIC builds. UNLISTED is "link-only, don't surface this
  // anywhere" — leave the generic shell in place and add noindex so a leaked
  // link never puts the page in a search index.
  if (build.visibility !== "PUBLIC") {
    return rewriteMeta(shellRes, { noindex: true })
  }

  // Builds persist a denormalized item imageName that rots across
  // image-scheme changes (see scripts/sync-images.ts). Re-resolve the OG
  // image by the item's stable uniqueName against the same image-map.json the
  // SPA uses, falling back to the stored value on a miss.
  const imageMap = await fetchImageMap(env, url)
  return rewriteMeta(shellRes, buildMeta(build, slug, imageMap))
}

function extractBuildSlug(pathname: string): string | null {
  if (!pathname.startsWith("/builds/")) return null
  const rest = pathname.slice("/builds/".length)
  const slug = rest.split("/")[0]
  if (!slug || slug.length > MAX_SLUG_LENGTH) return null
  if (RESERVED_BUILD_SUBPATHS.has(slug)) return null
  return slug
}

// Mirrors the SPA's `validateSearch` truthiness for `embed` (routes/
// builds.$slug.tsx) so the Worker and client agree on what counts as an embed.
function isEmbedRequest(url: URL): boolean {
  const embed = url.searchParams.get("embed")
  return embed === "1" || embed === "true"
}

async function fetchBuild(
  slug: string,
): Promise<BuildSummary | "not-found" | null> {
  try {
    // `embed=1` tells the API to return a slim payload and skip
    // maybeIncrementView — otherwise every page load would bump viewCount
    // (the Worker never forwards the vw_<slug> cookie).
    // The 2.5s abort keeps a slow API from blocking the page's TTFB — on
    // timeout we fall back to the generic shell.
    const res = await fetch(
      `${API_BASE}/builds/${encodeURIComponent(slug)}?embed=1`,
      {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(2500),
        cf: { cacheTtl: 60, cacheEverything: true },
      } as RequestInit,
    )
    if (res.status === 404) return "not-found"
    if (!res.ok) return null
    return (await res.json()) as BuildSummary
  } catch {
    return null
  }
}

function buildMeta(
  b: BuildSummary,
  slug: string,
  imageMap: Record<string, string> | null,
): Meta {
  // Title/author/og:type come from the shared module so this layer and the
  // client route (builds.$slug.tsx) can't disagree. This Worker only enriches
  // PUBLIC builds (handleBuildPage returns early otherwise), so og:type is
  // always "article" here, but route it through buildOgType for one source.
  const title = collapseWs(`${buildMetaTitle(b)} — ${SITE_NAME}`)

  const summary = collapseWs(b.guide?.summary ?? b.description ?? "")
  const stats = `${formatCount(b.likeCount)} likes · ${formatCount(b.viewCount)} views`
  const category = prettyCategory(b.item.category)

  const description = summary
    ? clamp(`${summary} · ${stats}`, 280)
    : `${b.item.name} (${category}) build on Arsenyx · ${stats}`

  const resolvedImage =
    (imageMap && b.item.uniqueName ? imageMap[b.item.uniqueName] : null) ??
    b.item.imageName
  return {
    title,
    description,
    canonical: `${SITE_URL}/builds/${slug}`,
    image: imageUrl(resolvedImage),
    ogType: buildOgType(b.visibility),
  }
}

// ---------------------------------------------------------------------------
// /browse/:category/:slug — item detail pages (static catalog)
// ---------------------------------------------------------------------------

function extractItemPath(
  pathname: string,
): { category: string; slug: string } | null {
  const m = /^\/browse\/([a-z-]+)\/([a-z0-9-]+)$/.exec(pathname)
  if (!m) return null
  const [, category, slug] = m
  if (!(category in CATEGORY_LABELS)) return null
  if (slug.length > MAX_SLUG_LENGTH) return null
  return { category, slug }
}

async function handleItemPage(
  request: Request,
  env: Env,
  url: URL,
  { category, slug }: { category: string; slug: string },
): Promise<Response> {
  const [shellRes, item] = await Promise.all([
    env.ASSETS.fetch(request),
    fetchItem(env, url, category, slug),
  ])

  const contentType = shellRes.headers.get("content-type") ?? ""
  if (!shellRes.ok || !contentType.includes("text/html")) return shellRes

  if (item === "not-found") {
    return rewriteMeta(
      new Response(shellRes.body, { status: 404, headers: shellRes.headers }),
      { noindex: true },
    )
  }
  if (!item) return rewriteMeta(shellRes, {})

  const label = CATEGORY_LABELS[category]
  const description = item.description
    ? clamp(
        `${collapseWs(item.description)} Plan and share ${item.name} builds on Arsenyx.`,
        160,
      )
    : `Plan and share ${item.name} (${label}) builds with mods, arcanes, and stats on Arsenyx.`

  return rewriteMeta(shellRes, {
    title: `${item.name} Builds — ${SITE_NAME}`,
    description,
    canonical: `${SITE_URL}/browse/${category}/${slug}`,
    image: imageUrl(item.imageName ?? null),
  })
}

// The catalog item JSON the SPA itself loads, fetched through the ASSETS
// binding (same colo, no external hop). A miss falls through to the SPA
// fallback and comes back as HTML — that's our 404 signal.
async function fetchItem(
  env: Env,
  base: URL,
  category: string,
  slug: string,
): Promise<
  { name: string; description?: string; imageName?: string } | "not-found" | null
> {
  try {
    const req = new Request(
      new URL(`/data/items/${category}/${slug}.json`, base).toString(),
    )
    const res = await env.ASSETS.fetch(req)
    const type = res.headers.get("content-type") ?? ""
    if (!res.ok || !type.includes("json")) return "not-found"
    return (await res.json()) as {
      name: string
      description?: string
      imageName?: string
    }
  } catch {
    return null
  }
}

// ---------------------------------------------------------------------------
// Everything else — static route meta, noindex hints, canonicals
// ---------------------------------------------------------------------------

async function handleGenericPage(
  request: Request,
  env: Env,
  url: URL,
): Promise<Response> {
  const shellRes = await env.ASSETS.fetch(request)
  const contentType = shellRes.headers.get("content-type") ?? ""
  if (!shellRes.ok || !contentType.includes("text/html")) return shellRes

  const path = stripTrailingSlash(url.pathname)

  if (
    NOINDEX_PATHS.has(path) ||
    path.startsWith("/auth/") ||
    /^\/org\/[^/]+\/settings$/.test(path)
  ) {
    return rewriteMeta(shellRes, { noindex: true })
  }

  if (path === "/browse") {
    // Mirror the SPA's validateSearch coercion (routes/browse.tsx): "all" is a
    // valid pseudo-category; any other unknown value collapses to "warframes".
    // Without matching it here the client canonical (?category=warframes) and
    // the edge canonical (bare /browse) disagree for junk category values.
    const raw = url.searchParams.get("category")
    const category =
      raw === "all" || (raw && raw in CATEGORY_LABELS) ? raw : "warframes"
    const label = category === "all" ? "All Items" : CATEGORY_LABELS[category]
    return rewriteMeta(shellRes, {
      title: `Browse ${label} — ${SITE_NAME}`,
      // Filtered/sorted/search variants collapse onto the category canonical.
      canonical: `${SITE_URL}/browse?category=${category}`,
    })
  }

  const staticMeta = STATIC_META[path]
  if (staticMeta) {
    return rewriteMeta(shellRes, {
      title: staticMeta.title,
      description: staticMeta.description,
      canonical: `${SITE_URL}${path === "/" ? "/" : path}`,
    })
  }

  // Dynamic pages we can't cheaply resolve at the edge (profiles, orgs):
  // self-canonical with the query stripped; the client route head fills in
  // the real title for rendering crawlers.
  if (/^\/(profile|org)\/[^/]+$/.test(path)) {
    return rewriteMeta(shellRes, { canonical: `${SITE_URL}${path}` })
  }

  // Unknown SPA route: default meta so the raw HTML still carries a title.
  return rewriteMeta(shellRes, {})
}

function stripTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// Compact `uniqueName → current imageName` map emitted by
// scripts/build-items-index.ts and served from Static Assets. Fetched through
// the ASSETS binding only on the build-page path.
async function fetchImageMap(
  env: Env,
  base: URL,
): Promise<Record<string, string> | null> {
  try {
    // The ASSETS binding is an in-isolate service binding; it never consults
    // Cloudflare's edge cache, so `cf: { cacheTtl, ... }` would be silently
    // ignored here (those directives only apply to global `fetch()`).
    const req = new Request(new URL("/data/image-map.json", base).toString())
    const res = await env.ASSETS.fetch(req)
    if (!res.ok) return null
    return (await res.json()) as Record<string, string>
  } catch {
    return null
  }
}

// Collapse all whitespace (including embedded newlines / tabs) to single
// spaces. Authored build names and guide summaries can contain literal
// newlines; some unfurl scrapers split on those when reading a `content="…"`
// attribute, mangling the preview.
function collapseWs(s: string): string {
  return s.replace(/\s+/g, " ").trim()
}

function imageUrl(imageName: string | null): string | null {
  if (!imageName) return null
  // Newer catalog data ships absolute `https://img.arsenyx.com/...` URLs
  // (see scripts/sync-images.ts). Pass those through unchanged. Legacy
  // saved builds may still carry a bare filename — fall back to our own
  // CDN root so the OG card resolves to something hosted by us instead
  // of the upstream CDN we no longer use.
  if (/^https?:\/\//i.test(imageName)) return imageName
  const clean = imageName.replace(/^\/+/, "")
  try {
    return new URL(clean, "https://img.arsenyx.com/").toString()
  } catch {
    return null
  }
}

function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return "0"
  if (n >= 10000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

function prettyCategory(c: string): string {
  if (!c) return ""
  return c.charAt(0).toUpperCase() + c.slice(1).toLowerCase()
}

function clamp(s: string, max: number): string {
  // Iterate by code point so we never split a UTF-16 surrogate pair
  // (emoji, supplementary-plane CJK) and leave a lone surrogate before the
  // ellipsis — some unfurl clients render that as U+FFFD.
  const chars = Array.from(s)
  if (chars.length <= max) return s
  return `${chars
    .slice(0, max - 1)
    .join("")
    .trimEnd()}…`
}

type Meta = {
  title?: string
  description?: string
  canonical?: string
  image?: string | null
  ogType?: string
  noindex?: boolean
}

// index.html ships with NO static <title>/<meta description> — this is the
// single server-side source of them, so it always injects both (falling back
// to the site defaults). Non-JS crawlers and unfurl bots read ONLY this
// server-injected set. Client-side, React/<HeadContent /> renders its own
// copies on hydration and navigation; those values are kept in step with this
// Worker (see src/lib/seo.ts), except og:description, which this layer enriches
// with live like/view stats. A JS-rendering crawler therefore sees both sets —
// they must agree (see the og:type note in seo.ts) since duplicate-but-
// conflicting tags are resolved unpredictably.
function rewriteMeta(res: Response, meta: Meta): Response {
  const title = escapeAttr(meta.title ?? `${SITE_NAME} — Warframe Build Planner`)
  const desc = escapeAttr(meta.description ?? DEFAULT_DESCRIPTION)
  const parts: string[] = [
    `<title>${title}</title>`,
    `<meta name="description" content="${desc}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${meta.ogType ?? "website"}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${desc}" />`,
    `<meta name="twitter:card" content="summary" />`,
    `<meta name="twitter:title" content="${title}" />`,
    `<meta name="twitter:description" content="${desc}" />`,
  ]
  if (meta.noindex) parts.push(`<meta name="robots" content="noindex" />`)
  if (meta.canonical) {
    const href = escapeAttr(meta.canonical)
    parts.push(`<link rel="canonical" href="${href}" />`)
    parts.push(`<meta property="og:url" content="${href}" />`)
  }
  if (meta.image) {
    const image = escapeAttr(meta.image)
    parts.push(
      `<meta property="og:image" content="${image}" />`,
      `<meta name="twitter:image" content="${image}" />`,
    )
  }

  // `HTMLRewriter` is a workerd global; we don't pull in the full types here
  // to keep this file dependency-free.
  const Rewriter = (globalThis as { HTMLRewriter: HTMLRewriterCtor })
    .HTMLRewriter
  return new Rewriter()
    .on("head", {
      element(el) {
        el.append(parts.join(""), { html: true })
      },
    })
    .transform(res)
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// Minimal local typings for the HTMLRewriter we use. The full @cloudflare
// types package isn't a dependency of apps/web — this file is bundled by
// wrangler at deploy time, not by Vite.
interface HTMLRewriterCtor {
  new (): HTMLRewriterInst
}
interface HTMLRewriterInst {
  on(selector: string, handlers: ElementHandlers): HTMLRewriterInst
  transform(response: Response): Response
}
interface ElementHandlers {
  element?(element: RewriterElement): void
}
interface RewriterElement {
  setInnerContent(content: string, opts?: { html?: boolean }): RewriterElement
  setAttribute(name: string, value: string): RewriterElement
  append(content: string, opts?: { html?: boolean }): RewriterElement
}
