import { readFileSync } from "node:fs"
import path from "node:path"

import {
  DEFAULT_DESCRIPTION,
  DEFAULT_TITLE,
  PAGE_META,
  RESERVED_BUILD_SUBPATHS,
  SITE_URL,
  type PagePath,
} from "@arsenyx/shared/seo/site"
import { describe, expect, it } from "vitest"

import { buildPageSeo, pageSeo, seo } from "../src/lib/seo"
import { Route as BrowseRoute } from "../src/routes/_app/browse"
import { Route as OrgSettingsRoute } from "../src/routes/_app/org.$slug_.settings"
import worker, {
  buildMeta,
  buildPageCacheKeyUrl,
  genericPageMeta,
  isBrowserNavigation,
  itemFallbackHtml,
  type Meta,
} from "./index"

describe("apex redirect", () => {
  const env = { ASSETS: { fetch: async () => new Response("") } }
  const ctx = { waitUntil() {} }
  const location = async (url: string) => {
    const res = await worker.fetch(new Request(url), env as never, ctx as never)
    return res.headers.get("location")
  }

  it("keeps the path and query on www", async () => {
    expect(await location("https://arsenyx.com/builds/x?y=1")).toBe(
      "https://www.arsenyx.com/builds/x?y=1",
    )
  })

  it("never redirects off-site for scheme-relative paths", async () => {
    for (const path of ["//evil.example/x", "/\\evil.example/x"]) {
      const loc = await location(`https://arsenyx.com${path}`)
      expect(new URL(loc!).origin).toBe("https://www.arsenyx.com")
    }
  })
})

describe("isBrowserNavigation", () => {
  const req = (headers: Record<string, string>) =>
    new Request("https://www.arsenyx.com/builds/x", { headers })
  const chrome =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36"

  it("fast-paths a real browser navigation", () => {
    expect(
      isBrowserNavigation(
        req({ "sec-fetch-dest": "document", "user-agent": chrome }),
      ),
    ).toBe(true)
  })

  it("keeps the enriched path for unfurlers without Sec-Fetch headers", () => {
    expect(
      isBrowserNavigation(
        req({ "user-agent": "Mozilla/5.0 (compatible; Discordbot/2.0)" }),
      ),
    ).toBe(false)
  })

  it("keeps the enriched path for Chrome-based crawlers that send Sec-Fetch", () => {
    expect(
      isBrowserNavigation(
        req({
          "sec-fetch-dest": "document",
          "user-agent": `${chrome} (compatible; Googlebot/2.1)`,
        }),
      ),
    ).toBe(false)
  })
})

// The two invariants whose regression is expensive: a deploy serving a stale
// asset shell (white screen), or one hot slug fragmenting across tracking
// params. The Cache API hit/store path needs workerd and is not exercised.
describe("buildPageCacheKeyUrl", () => {
  const url = new URL("https://www.arsenyx.com/builds/wPDrEvV3Wf")

  it("namespaces the key by the deploy version so a deploy starts fresh", () => {
    const a = buildPageCacheKeyUrl(url, "v1")
    const b = buildPageCacheKeyUrl(url, "v2")
    expect(a).not.toBe(b)
  })

  it("drops the query string so tracking params don't fragment the hot slug", () => {
    const tracked = new URL(
      "https://www.arsenyx.com/builds/wPDrEvV3Wf?utm_source=x&fbclid=y",
    )
    expect(buildPageCacheKeyUrl(tracked, "v1")).toBe(
      buildPageCacheKeyUrl(url, "v1"),
    )
  })
})

// The two head layers must emit identical tags (apps/web/CLAUDE.md). Both read
// PAGE_META; this pins that each derives the same final values from it.
describe("static page meta parity (worker vs client seo())", () => {
  const client = (head: ReturnType<typeof seo>) => {
    const get = (key: string, value: string) =>
      head.meta.find((m) => m[key] === value)?.content
    return {
      title: head.meta.find((m) => m.title)?.title,
      description: get("name", "description"),
      canonical: head.links[0]?.href,
      noindex: get("name", "robots") === "noindex",
    }
  }
  const edge = (meta: Meta) => ({
    title: meta.title ?? DEFAULT_TITLE,
    description: meta.description ?? DEFAULT_DESCRIPTION,
    canonical: meta.canonical,
    noindex: meta.noindex ?? false,
  })

  for (const path of Object.keys(PAGE_META) as PagePath[]) {
    it(path, () => {
      expect(edge(genericPageMeta(new URL(path, SITE_URL)))).toEqual(
        client(pageSeo(path)),
      )
    })
  }

  // The routes' own head(), fed the search their validateSearch produces.
  type Head = (ctx: unknown) => ReturnType<typeof seo>
  const validateBrowse = BrowseRoute.options.validateSearch as (
    search: Record<string, unknown>,
  ) => unknown
  for (const raw of ["melee", "all", "junk"]) {
    it(`/browse?category=${raw}`, () => {
      const url = new URL(`/browse?category=${raw}`, SITE_URL)
      const search = validateBrowse({ category: raw })
      const head = BrowseRoute.options.head as Head
      expect(edge(genericPageMeta(url))).toEqual(
        client(head({ match: { search } })),
      )
    })
  }

  it("/org/:slug/settings", () => {
    const url = new URL("/org/acme/settings", SITE_URL)
    const head = OrgSettingsRoute.options.head as Head
    expect(edge(genericPageMeta(url))).toEqual(
      client(head({ params: { slug: "acme" } })),
    )
  })

  // buildPageSeo is the build route's head (routes/_app/builds.$slug.tsx).
  it("/builds/:slug (public)", () => {
    const b = {
      name: "Eidolon\nsniper",
      description: "A  build",
      visibility: "PUBLIC" as const,
      hideAuthor: false,
      likeCount: 1200,
      viewCount: 5,
      item: {
        name: "Rubico",
        category: "primary",
        uniqueName: "/x",
        imageName: null,
      },
      user: { name: "N", username: "n", displayUsername: "N\tick" },
      organization: null,
      guide: null,
    }
    const meta = buildMeta(b as never, "abc", null)
    expect(edge(meta)).toEqual(client(buildPageSeo(b, "abc", null)))
    expect(meta.ogDescription).toBe(
      `${meta.description} · 1.2k likes · 5 views`,
    )
  })
})

describe("noindex", () => {
  // A Disallow would block the crawl that reads the noindex, so the URL could
  // still be indexed URL-only.
  it("robots.txt disallows none of the noindex pages", () => {
    const robots = readFileSync(
      path.resolve(import.meta.dirname, "../public/robots.txt"),
      "utf8",
    )
    const disallows = [...robots.matchAll(/^Disallow:\s*(\S+)/gm)].map(
      (m) => m[1],
    )
    const noindex = [
      ...(Object.keys(PAGE_META) as PagePath[]).filter(
        (p) => genericPageMeta(new URL(p, SITE_URL)).noindex,
      ),
      "/auth/signin",
      "/org/acme/settings",
    ]
    for (const rule of disallows) {
      // robots rules are path prefixes where `*` matches any run.
      const re = new RegExp(
        `^${rule
          .split("*")
          .map((s) => s.replace(/[.?+^$()|[\]{}\\]/g, "\\$&"))
          .join(".*")}`,
      )
      expect(noindex.filter((p) => re.test(p))).toEqual([])
    }
  })
})

describe("RESERVED_BUILD_SUBPATHS", () => {
  it("lists exactly the static /builds/<segment> routes", () => {
    const tree = readFileSync(
      path.resolve(import.meta.dirname, "../src/routeTree.gen.ts"),
      "utf8",
    )
    const statics = new Set(
      [...tree.matchAll(/fullPath: '\/builds\/([^'/$]+)'/g)].map((m) => m[1]),
    )
    expect(statics).toEqual(RESERVED_BUILD_SUBPATHS)
  })
})

describe("itemFallbackHtml", () => {
  const saryn = {
    name: "Saryn",
    description: "Toxicity is Saryn's strength.",
    abilities: [
      {
        name: "Spores",
        description:
          "Inflict a <DT_CORROSIVE_COLOR>Corrosive pox for |DMG| damage.",
      },
    ],
  }

  it("renders name, description and abilities with game markup stripped", () => {
    const html = itemFallbackHtml(saryn, "warframes", "Warframes")
    expect(html).toContain("<h1>Saryn Builds</h1>")
    expect(html).toContain("Toxicity is Saryn's strength.")
    expect(html).toContain(
      "<strong>Spores</strong>: Inflict a Corrosive pox for damage.",
    )
    expect(html).not.toContain("DT_")
    expect(html).not.toContain("|DMG|")
    expect(html).toContain('href="/browse?category=warframes"')
  })

  it("escapes HTML in catalog text", () => {
    const html = itemFallbackHtml(
      { name: 'A & "B"', description: "x > y" },
      "primary",
      "Primary",
    )
    expect(html).toContain("A &amp; &quot;B&quot; Builds")
    expect(html).not.toContain("<h2>Abilities")
  })
})
