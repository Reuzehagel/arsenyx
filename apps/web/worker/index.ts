// Bundled by wrangler (see wrangler.toml `main`). Runs for every HTML
// navigation (run_worker_first excludes static asset directories) and acts as
// a lightweight edge "SSR head": it 301s the apex host onto the canonical
// www origin and injects per-page <title>/<meta>/<link rel=canonical> into
// the SPA shell so crawlers and unfurl bots get real metadata in the initial
// HTML response — no JS rendering required. Every user agent gets the same
// page body; the one split is that real browsers skip the build-page API wait
// and get default head meta, which the client replaces with the same values
// (see isBrowserNavigation).
//
// Values must equal the client route heads; both derive from
// @arsenyx/shared/seo and index.test.ts pins the parity. Public-build
// og:description is the one deliberate difference: it appends live like/view
// stats for unfurls.

import type { BuildMetaResponse } from "@arsenyx/shared/api/build-dto"
import {
  browseMeta,
  coerceBrowseCategory,
} from "@arsenyx/shared/seo/browse-meta"
import {
  buildMetaDescription,
  buildMetaTitle,
  buildOgType,
  resolveBuildImage,
} from "@arsenyx/shared/seo/build-meta"
import {
  itemMetaDescription,
  itemMetaTitle,
} from "@arsenyx/shared/seo/item-meta"
import {
  absoluteImage,
  API_ORIGIN,
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  extractBuildSlug,
  getItemUrl,
  isEmbedParam,
  isPagePath,
  MAX_SLUG_LENGTH,
  NOINDEX_PATTERNS,
  PAGE_META,
  pageTitle,
  SITE_NAME,
  SITE_URL,
  type PageMeta,
} from "@arsenyx/shared/seo/site"
import {
  CATALOG_FILES,
  catalogUrl,
  itemDetailUrl,
} from "@arsenyx/shared/warframe/catalog-files"
import {
  getCategoryLabel,
  isValidCategory,
} from "@arsenyx/shared/warframe/categories"

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
  // Per-deploy version metadata (wrangler [version_metadata] binding). Its `id`
  // changes on every deploy; we mix it into the build-page cache key so a deploy
  // starts a fresh cache namespace (see handleBuildPage). Optional so local /
  // dry-run runs without the binding still type-check.
  CF_VERSION_METADATA?: { id: string }
}

interface ExecutionCtx {
  waitUntil(promise: Promise<unknown>): void
}

// Per-colo Cache API TTL for fully-rewritten PUBLIC build-page HTML. One hot
// slug dominates traffic, so caching the rendered shell lets repeat hits in a
// colo skip the asset fetch, the API round-trip, and the HTMLRewriter pass.
// Tradeoff: the build name/description/like/view counts baked into the <head>
// meta — and a just-flipped visibility — can lag by up to this window. Only the
// crawler-facing meta is affected; the page BODY is always live (the SPA
// refetches client-side). Lower this if meta freshness matters more than hit rate.
const BUILD_HTML_TTL = 300

// TTL for the anonymous API meta subrequest — the cold-miss shield behind the
// HTML cache above. Kept short and decoupled from BUILD_HTML_TTL so the two
// caches don't compound: a freshly-written HTML entry carries meta at most this
// stale. The API also edge-caches this read (DETAIL_TTL, 600s, in
// apps/api/src/routes/builds.ts), so worst-case meta staleness is
// ~BUILD_HTML_TTL + BUILD_META_TTL + DETAIL_TTL (~16 min).
const BUILD_META_TTL = 60

export default {
  async fetch(
    request: Request,
    env: Env,
    ctx: ExecutionCtx,
  ): Promise<Response> {
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
      // Assign the path rather than resolving it: `new URL("//evil.example",
      // SITE_URL)` is scheme-relative and would redirect off-site.
      const target = new URL(SITE_URL)
      target.pathname = url.pathname
      target.search = url.search
      return new Response(null, {
        status: 301,
        headers: { location: target.toString() },
      })
    }

    const buildSlug = extractBuildSlug(url.pathname)
    if (buildSlug) return handleBuildPage(request, env, url, buildSlug, ctx)

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
  ctx: ExecutionCtx,
): Promise<Response> {
  // Embed iframes (`?embed=1`) get a dedicated lightweight shell instead of
  // the full SPA index.html, so a guide page with many embeds doesn't boot
  // the whole app once per iframe. embed.html reads the slug from the path
  // (the iframe URL is unchanged), so we just serve its body for this URL.
  //
  // html_handling (pinned in wrangler.toml) redirects `/embed.html` → `/embed`;
  // passing that redirect to the iframe would bounce it to the SPA fallback,
  // so ask for the clean `/embed` path, which is served 200.
  if (isEmbedParam(url.searchParams.get("embed"))) {
    return allowPartnerFraming(
      await env.ASSETS.fetch(
        new Request(new URL("/embed", url).toString(), request),
      ),
    )
  }

  // Per-colo edge cache for the rendered PUBLIC build shell. The injected meta
  // is derived from an anonymous API read, so the HTML is identical for every
  // visitor — safe to share across users. The key drops the query string so
  // tracking params (utm_*, fbclid, …) don't fragment the one hot slug; the
  // ?embed=1 variant already returned above, so it never reaches this key.
  //
  // The key is namespaced by the deploy version: the cached shell embeds this
  // deploy's hashed /assets/*.js tags, which rotate on the next deploy and then
  // 404 → SPA-fallback HTML (white screen). The per-colo Cache API survives
  // deploys, so without this a warm colo would serve the pre-deploy shell for
  // the whole TTL; a new version id orphans old entries (never matched again)
  // and they age out by TTL.
  const cache = edgeCache()
  const cacheKey = new Request(
    buildPageCacheKeyUrl(url, env.CF_VERSION_METADATA?.id),
  )
  if (cache) {
    const hit = await cache.match(cacheKey)
    if (hit) return hit
  }

  // A person's browser doesn't read the injected meta — <HeadContent /> sets
  // the same title/canonical client-side — so don't make them wait on the API
  // round-trip (0.2–1s on a colo miss) for it. Crawlers and unfurl bots still
  // take the enriched path below; the page body is identical either way.
  if (isBrowserNavigation(request)) {
    return rewriteMeta(await env.ASSETS.fetch(request), {})
  }

  // Kick off the OG image-map fetch up front so it overlaps the asset + API
  // fetches below; only the PUBLIC branch awaits it. fetchImageMap never
  // rejects (returns null on error), so the not-found / non-public early
  // returns can leave it unawaited safely.
  const imageMapPromise = fetchImageMap(env, url)

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

  const res = rewriteMeta(
    shellRes,
    buildMeta(build, slug, await imageMapPromise),
  )

  // Only the fully-enriched PUBLIC HTML is cached. 404s, API-error fallbacks,
  // and private/unlisted shells are left uncached so a transient blip or a
  // just-changed visibility can't pin a wrong response for the whole TTL.
  if (!cache) return res
  return cacheStore(res, cacheKey, cache, ctx)
}

// Hosts allowed to iframe the embed viewer. `public/_headers` sends
// `frame-ancestors 'self'` for the whole site — deliberately, so a compromise
// of a partner host can't clickjack /create or /admin — and this widens it for
// the one response that is meant to be framed: the `?embed=1` shell. Keep the
// two in sync; adding a partner means editing this list, not `_headers`.
const EMBED_FRAME_ANCESTORS = [
  "'self'",
  "https://profit-taker.com",
  "https://*.profit-taker.com",
  "https://pt-guide.pages.dev",
  "https://*.pt-guide.pages.dev",
].join(" ")

// Re-wrap: a Response from the ASSETS binding has an immutable header guard,
// so the CSP has to be set on a fresh Response around the same body.
function allowPartnerFraming(res: Response): Response {
  const out = new Response(res.body, res)
  out.headers.set(
    "content-security-policy",
    `frame-ancestors ${EMBED_FRAME_ANCESTORS}`,
  )
  return out
}

// Bot UAs that may still send Sec-Fetch-* (headless-Chrome crawlers/renderers).
const BOT_UA =
  /bot|crawl|spider|slurp|facebookexternalhit|embedly|preview|whatsapp|lighthouse|headless/i

// True for a top-level navigation by a real browser. Browsers send
// Sec-Fetch-Dest: document on navigations; plain-HTTP crawlers and unfurlers
// (Discord, Twitter, Slack, …) don't, and the UA check catches the
// Chrome-based ones that do. Erring towards "bot" only costs latency.
// Exported for unit tests.
export function isBrowserNavigation(request: Request): boolean {
  if (request.headers.get("sec-fetch-dest") !== "document") return false
  return !BOT_UA.test(request.headers.get("user-agent") ?? "")
}

async function fetchBuild(
  slug: string,
): Promise<BuildMetaResponse | "not-found" | null> {
  try {
    // The slim payload, and no view count (the Worker never forwards the
    // vw_<slug> cookie, so every unfurl would count). The 2.5s abort keeps a
    // slow API from blocking TTFB; on timeout, default meta.
    // shortcut: still the legacy `?embed=1` name, which old and new APIs both
    // read, so the two Workers deploy in either order. Switch to `?meta=1` in a
    // later release, then drop LEGACY_META_QUERY from _build-snapshot.ts.
    const res = await fetch(
      `${API_ORIGIN}/builds/${encodeURIComponent(slug)}?embed=1`,
      {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(2500),
        // Per-status TTL rather than a blanket cacheTtl: never cache a 5xx (a
        // transient API blip would otherwise pin a degraded shell for the whole
        // window), briefly cache 404s to blunt dead-link hammering, and cache
        // good meta only briefly — this is the cold-miss shield behind the HTML
        // cache, kept short (BUILD_META_TTL) so the two TTLs don't compound.
        cf: {
          cacheEverything: true,
          cacheTtlByStatus: {
            "200-299": BUILD_META_TTL,
            "404": 10,
            "500-599": 0,
          },
        },
      } as RequestInit,
    )
    if (res.status === 404) return "not-found"
    if (!res.ok) return null
    return (await res.json()) as BuildMetaResponse
  } catch {
    return null
  }
}

// Head meta for a PUBLIC build. Exported for the parity test.
export function buildMeta(
  b: BuildMetaResponse,
  slug: string,
  imageMap: Record<string, string> | null,
): Meta {
  const description = buildMetaDescription(b)
  const stats = `${formatCount(b.likeCount)} likes · ${formatCount(b.viewCount)} views`
  return {
    title: pageTitle(buildMetaTitle(b)),
    description,
    ogDescription: `${description} · ${stats}`,
    canonical: `${SITE_URL}/builds/${slug}`,
    image: absoluteImage(resolveBuildImage(b, imageMap)),
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
  if (!isValidCategory(category)) return null
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

  const label = getCategoryLabel(category)
  const description = itemMetaDescription(item, label)

  return rewriteMeta(shellRes, {
    title: pageTitle(itemMetaTitle(item.name)),
    description,
    canonical: `${SITE_URL}${getItemUrl(category, slug)}`,
    image: absoluteImage(item.imageName),
    body: itemFallbackHtml(item, category, label),
  })
}

type CatalogItem = {
  name: string
  description?: string
  imageName?: string
  passiveDescription?: string
  abilities?: { name: string; description?: string }[]
}

// Plain-HTML stand-in for #root on item pages, so crawlers that don't run JS
// (Bing, DuckDuckGo) index real text and links instead of the loading
// placeholder. React's createRoot replaces it on first render. Built only from
// the catalog JSON already fetched for the meta, so it costs no subrequest.
export function itemFallbackHtml(
  item: CatalogItem,
  category: string,
  label: string,
): string {
  const text = (s: string) => escapeAttr(stripTags(s))
  const parts = [
    `<main><h1>${text(item.name)} Builds</h1>`,
    `<p>${text(label)}</p>`,
  ]
  if (item.description) parts.push(`<p>${text(item.description)}</p>`)
  if (item.passiveDescription)
    parts.push(`<p>Passive: ${text(item.passiveDescription)}</p>`)
  if (item.abilities?.length) {
    parts.push("<h2>Abilities</h2><ul>")
    for (const a of item.abilities) {
      const desc = a.description ? `: ${text(a.description)}` : ""
      parts.push(`<li><strong>${text(a.name)}</strong>${desc}</li>`)
    }
    parts.push("</ul>")
  }
  parts.push(
    `<p><a href="/browse?category=${encodeURIComponent(category)}">Browse ${text(label)}</a> · `,
    `<a href="/builds">All builds</a></p></main>`,
  )
  return parts.join("")
}

// Catalog text carries game markup (`<DT_POISON_COLOR>`, `<ENERGY>`, `|VAL|`
// placeholders) that only the SPA's StatText knows how to render.
function stripTags(s: string): string {
  return s
    .replace(/<[^>]*>/g, "")
    .replace(/\|[A-Z_]+\|%?/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

// The catalog item JSON the SPA itself loads, fetched through the ASSETS
// binding (same colo, no external hop). A miss falls through to the SPA
// fallback and comes back as HTML — that's our 404 signal.
async function fetchItem(
  env: Env,
  base: URL,
  category: string,
  slug: string,
): Promise<CatalogItem | "not-found" | null> {
  try {
    const req = new Request(
      new URL(itemDetailUrl(category, slug), base).toString(),
    )
    const res = await env.ASSETS.fetch(req)
    // A 5xx is an asset-server blip, not a dead link: default meta, no 404.
    if (!res.ok) return res.status === 404 ? "not-found" : null
    const type = res.headers.get("content-type") ?? ""
    if (!type.includes("json")) return "not-found"
    return (await res.json()) as CatalogItem
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

  return rewriteMeta(shellRes, genericPageMeta(url))
}

// Head meta for every page that isn't a build or item detail. Pure, so the
// parity test can compare it with the client route heads. Exported for tests.
export function genericPageMeta(url: URL): Meta {
  const path = stripTrailingSlash(url.pathname)

  if (path === "/browse") {
    // Same coercion as the SPA's validateSearch (routes/_app/browse.tsx), so
    // the client and edge canonicals agree for junk category values.
    const m = browseMeta(coerceBrowseCategory(url.searchParams.get("category")))
    return {
      title: pageTitle(m.title),
      description: m.description,
      canonical: `${SITE_URL}${m.canonicalPath}`,
    }
  }

  if (isPagePath(path)) return staticMeta(PAGE_META[path], path)

  const pattern = NOINDEX_PATTERNS.find((p) => p.pattern.test(path))
  if (pattern) return staticMeta(pattern.meta, path)

  // Dynamic pages we can't cheaply resolve at the edge (profiles, orgs):
  // self-canonical with the query stripped; the client route head fills in
  // the real title for rendering crawlers.
  if (/^\/(profile|org)\/[^/]+$/.test(path)) {
    return { canonical: `${SITE_URL}${path}` }
  }

  // Unknown SPA route: default meta so the raw HTML still carries a title.
  return {}
}

// Mirrors the client's pageSeo(): self-canonical unless noindexed.
function staticMeta(m: PageMeta, path: string): Meta {
  return {
    title: pageTitle(m.title),
    description: m.description,
    ...(m.noindex ? { noindex: true } : { canonical: `${SITE_URL}${path}` }),
  }
}

function stripTrailingSlash(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith("/")
    ? pathname.slice(0, -1)
    : pathname
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

// Cache key URL for a build page's rendered shell. Two invariants, both
// load-bearing (see handleBuildPage's cache comment + tests in index.test.ts):
//   - drops the query string, so tracking params (utm_*, fbclid, …) can't
//     fragment the one hot slug across many cache entries;
//   - namespaces by the deploy version, so a deploy starts a fresh namespace —
//     the cached shell embeds this deploy's hashed /assets/*.js, which 404 after
//     the next deploy. Falls back to "dev" when the binding is absent.
// Exported for unit tests; the synthetic `?__v=` is only ever a cache key.
export function buildPageCacheKeyUrl(
  url: URL,
  version: string | undefined,
): string {
  return `${url.origin}${url.pathname}?__v=${encodeURIComponent(version ?? "dev")}`
}

// Null outside workerd (e.g. the vitest runtime): callers skip the cache.
function edgeCache(): EdgeCache | null {
  const c = (globalThis as { caches?: { default?: EdgeCache } }).caches
  return c?.default ?? null
}

// Store a clone of the streamed rewrite result while the original streams to the
// user (waitUntil keeps the put alive past the response). We re-wrap to own the
// headers: the asset shell can carry _headers-derived Cache-Control, and a
// shared cache must never hold a Set-Cookie — so overwrite the TTL and strip any
// cookie explicitly. Cloning a streaming body tees it, so no manual buffering.
function cacheStore(
  res: Response,
  key: Request,
  cache: EdgeCache,
  ctx: ExecutionCtx,
): Response {
  const out = new Response(res.body, res)
  out.headers.delete("set-cookie")
  // max-age=0 + must-revalidate keeps browsers revalidating every navigation
  // (so a fresh Worker run picks up updated meta), while s-maxage lets the
  // shared per-colo Cache API serve the entry for the TTL. Without max-age a
  // browser could heuristically cache the shell and pin stale <head> meta.
  out.headers.set(
    "cache-control",
    `public, max-age=0, s-maxage=${BUILD_HTML_TTL}, must-revalidate`,
  )
  ctx.waitUntil(cache.put(key, out.clone()))
  return out
}

// `uniqueName → imageName` map (~290 KB), memoized per isolate: buildMeta reads
// one key, and re-parsing it per cache miss was the build path's largest CPU
// cost. A deploy starts fresh isolates, so it's never staler than the deploy.
// The VALUE is memoized, not the promise: awaiting another request's pending
// I/O can hang when Workers cancels it with that request. Failures (null) are
// not cached.
let imageMapCache: Record<string, string> | null = null

async function fetchImageMap(
  env: Env,
  base: URL,
): Promise<Record<string, string> | null> {
  if (imageMapCache) return imageMapCache
  const map = await loadImageMap(env, base)
  if (map) imageMapCache = map
  return map
}

// Never rejects, so handleBuildPage may leave it unawaited on early returns.
async function loadImageMap(
  env: Env,
  base: URL,
): Promise<Record<string, string> | null> {
  try {
    // The ASSETS binding is an in-isolate service binding; it never consults
    // Cloudflare's edge cache, so `cf: { cacheTtl, ... }` would be silently
    // ignored here (those directives only apply to global `fetch()`).
    const req = new Request(
      new URL(catalogUrl(CATALOG_FILES.imageMap), base).toString(),
    )
    const res = await env.ASSETS.fetch(req)
    if (!res.ok) return null
    return (await res.json()) as Record<string, string>
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

export type Meta = {
  title?: string
  description?: string
  /** Defaults to `description`. */
  ogDescription?: string
  canonical?: string
  image?: string
  ogType?: string
  noindex?: boolean
  /** Trusted HTML that replaces the #root loading placeholder. */
  body?: string
}

// index.html has no static <title>/<meta description>, so this always injects
// both (site defaults when `meta` has none). Non-JS crawlers read only these.
function rewriteMeta(res: Response, meta: Meta): Response {
  const title = escapeAttr(meta.title ?? DEFAULT_TITLE)
  const desc = escapeAttr(meta.description ?? DEFAULT_DESCRIPTION)
  const ogDesc = meta.ogDescription ? escapeAttr(meta.ogDescription) : desc
  const parts: string[] = [
    `<title>${title}</title>`,
    `<meta name="description" content="${desc}" />`,
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${meta.ogType ?? "website"}" />`,
    `<meta property="og:title" content="${title}" />`,
    `<meta property="og:description" content="${ogDesc}" />`,
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

  const Rewriter = (globalThis as unknown as { HTMLRewriter: HTMLRewriterCtor })
    .HTMLRewriter
  const rewriter = new Rewriter().on("head", {
    element(el) {
      el.append(parts.join(""), { html: true })
    },
  })
  const body = meta.body
  if (body)
    rewriter.on("#root", {
      element(el) {
        el.setInnerContent(body, { html: true })
      },
    })
  return rewriter.transform(res)
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
}

// Local typings for the workerd globals used here; @cloudflare/workers-types
// isn't a dependency of apps/web.
interface HTMLRewriterCtor {
  new (): HTMLRewriterInst
}
interface EdgeCache {
  match(request: Request): Promise<Response | undefined>
  put(request: Request, response: Response): Promise<void>
}
interface HTMLRewriterInst {
  on(selector: string, handlers: ElementHandlers): HTMLRewriterInst
  transform(response: Response): Response
}
interface ElementHandlers {
  element?(element: RewriterElement): void
}
interface RewriterElement {
  append(content: string, opts?: { html?: boolean }): RewriterElement
  setInnerContent(content: string, opts?: { html?: boolean }): RewriterElement
}
