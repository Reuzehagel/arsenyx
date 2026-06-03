// Bundled by wrangler (see wrangler.toml `main`). Runs only for paths matched
// by `run_worker_first` — everything else is served by Workers Static Assets
// directly. We use it to enrich link-unfurl meta tags for /builds/:slug pages
// so Discord previews show the build name + author + summary instead of the
// generic site description from index.html.

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> }
}

const API_BASE = "https://api.arsenyx.com"
const RESERVED_BUILD_SUBPATHS = new Set(["mine", "bookmarks", "new"])
// Real slugs are nanoid(10) from a 56-char alphabet; 64 is a generous
// upper bound that still cheaply rejects amplification attempts that try to
// pin Postgres findUnique with megabyte-sized strings.
const MAX_SLUG_LENGTH = 64

// UA fragment for Discord's link-unfurl bot. Deliberately excludes search
// crawlers (googlebot/bingbot/applebot): serving them rewritten HTML that
// real users never see is cloaking, and indexing UNLISTED build URLs would
// defeat their "link-only" intent. Matching is case-insensitive substring.
const BOT_UA_FRAGMENTS = ["discordbot"]

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

    const slug = extractSlug(url.pathname)
    if (!slug) return env.ASSETS.fetch(request)

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

    const ua = request.headers.get("user-agent") ?? ""
    if (!isUnfurlBot(ua)) return env.ASSETS.fetch(request)

    // Workers Static Assets redirects `/index.html` → `/` by default
    // (html_handling), so we ask for the original path and let the SPA
    // fallback (`not_found_handling = "single-page-application"`) serve
    // index.html with a 200. The ASSETS binding bypasses the Worker, so
    // there's no infinite loop here.
    const [shellRes, build] = await Promise.all([
      env.ASSETS.fetch(request),
      fetchBuild(slug),
    ])

    // Only inject meta for PUBLIC builds. UNLISTED is "link-only, don't
    // surface this anywhere" — we honour that by leaving the generic
    // site-wide shell in place for unfurls of unlisted URLs.
    if (!build || build.visibility !== "PUBLIC") return shellRes
    const contentType = shellRes.headers.get("content-type") ?? ""
    if (!shellRes.ok || !contentType.includes("text/html")) return shellRes

    // Builds persist a denormalized item imageName that rots across
    // image-scheme changes (see scripts/sync-images.ts). Re-resolve the OG
    // image by the item's stable uniqueName against the same image-map.json the
    // SPA uses, falling back to the stored value on a miss.
    const imageMap = await fetchImageMap(env, url)
    const canonical = new URL(`/builds/${slug}`, url).toString()
    return rewriteMeta(shellRes, buildMeta(build, canonical, imageMap))
  },
}

// Compact `uniqueName → current imageName` map emitted by
// scripts/build-items-index.ts and served from Static Assets. Fetched through
// the ASSETS binding (same colo, no external hop) only on the unfurl path.
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

function extractSlug(pathname: string): string | null {
  if (!pathname.startsWith("/builds/")) return null
  const rest = pathname.slice("/builds/".length)
  const slug = rest.split("/")[0]
  if (!slug || slug.length > MAX_SLUG_LENGTH) return null
  if (RESERVED_BUILD_SUBPATHS.has(slug)) return null
  return slug
}

function isUnfurlBot(ua: string): boolean {
  const lower = ua.toLowerCase()
  return BOT_UA_FRAGMENTS.some((frag) => lower.includes(frag))
}

// Mirrors the SPA's `validateSearch` truthiness for `embed` (routes/
// builds.$slug.tsx) so the Worker and client agree on what counts as an embed.
function isEmbedRequest(url: URL): boolean {
  const embed = url.searchParams.get("embed")
  return embed === "1" || embed === "true"
}

async function fetchBuild(slug: string): Promise<BuildSummary | null> {
  try {
    // `embed=1` tells the API to return a slim payload and skip
    // maybeIncrementView — otherwise every Discord scrape would bump viewCount
    // (the Worker never forwards the vw_<slug> cookie).
    // The 2.5s abort keeps a slow API from blocking the unfurl past Discord's
    // ~3-5s patience window — on timeout we fall back to the generic shell.
    const res = await fetch(
      `${API_BASE}/builds/${encodeURIComponent(slug)}?embed=1`,
      {
        headers: { accept: "application/json" },
        signal: AbortSignal.timeout(2500),
        cf: { cacheTtl: 60, cacheEverything: true },
      } as RequestInit,
    )
    if (!res.ok) return null
    return (await res.json()) as BuildSummary
  } catch {
    return null
  }
}

type Meta = {
  title: string
  description: string
  image: string | null
  url: string
}

function buildMeta(
  b: BuildSummary,
  url: string,
  imageMap: Record<string, string> | null,
): Meta {
  // `hideAuthor` means "this is an org build — don't reveal the underlying
  // user, just show the org". Falling back to null when hideAuthor=true
  // would drop the org credit entirely, which is the opposite of intent.
  const author = b.hideAuthor
    ? (b.organization?.name ?? null)
    : (b.organization?.name ??
      b.user.displayUsername ??
      b.user.username ??
      b.user.name)

  const title = collapseWs(
    author
      ? `${b.item.name} build by ${author} — Arsenyx`
      : `${b.item.name} build — Arsenyx`,
  )

  const summary = collapseWs(b.guide?.summary ?? b.description ?? "")
  const stats = `${formatCount(b.likeCount)} likes · ${formatCount(b.viewCount)} views`
  const category = prettyCategory(b.item.category)

  const description = summary
    ? clamp(`${summary} · ${stats}`, 280)
    : `${b.item.name} (${category}) build on Arsenyx · ${stats}`

  const resolvedImage =
    (imageMap && b.item.uniqueName ? imageMap[b.item.uniqueName] : null) ??
    b.item.imageName
  return { title, description, image: imageUrl(resolvedImage), url }
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

function rewriteMeta(res: Response, meta: Meta): Response {
  const esc = {
    title: escapeAttr(meta.title),
    description: escapeAttr(meta.description),
    url: escapeAttr(meta.url),
    image: meta.image ? escapeAttr(meta.image) : null,
  }
  const injected =
    `<meta property="og:type" content="article" />` +
    `<meta property="og:site_name" content="Arsenyx" />` +
    `<meta property="og:title" content="${esc.title}" />` +
    `<meta property="og:description" content="${esc.description}" />` +
    `<meta property="og:url" content="${esc.url}" />` +
    (esc.image ? `<meta property="og:image" content="${esc.image}" />` : "")

  // `HTMLRewriter` is a workerd global; we don't pull in the full types here
  // to keep this file dependency-free.
  const Rewriter = (globalThis as { HTMLRewriter: HTMLRewriterCtor })
    .HTMLRewriter
  return new Rewriter()
    .on("title", {
      element(el) {
        el.setInnerContent(meta.title)
      },
    })
    .on('meta[name="description"]', {
      element(el) {
        el.setAttribute("content", meta.description)
      },
    })
    .on("head", {
      element(el) {
        el.append(injected, { html: true })
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
