import type { Context } from "hono"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// Mock only safeFetch; keep the real SafeFetchError so the `instanceof` checks
// in import.ts still match. fetchOverframeHtml streams the Response body, so
// the mock returns a real Response built from an HTML string.
vi.mock("../safe-fetch", async (importActual) => {
  const actual = await importActual<typeof import("../safe-fetch")>()
  return { ...actual, safeFetch: vi.fn() }
})

// The raw route handler is now sign-in-gated; stub getSession so handler tests
// can simulate signed-in (default) and signed-out callers without Better Auth.
vi.mock("../../lib/session", () => ({ getSession: vi.fn() }))

import { getSession } from "../../lib/session"
import { SafeFetchError, safeFetch } from "../safe-fetch"
import {
  isValidOverframeBuildUrl,
  scrapeOverframeBuild,
  scrapeOverframeFromNextData,
} from "./import"

const BUILD_URL = "https://overframe.gg/build/1005502/saryn-prime"

// __NEXT_DATA__ shaped like a real Overframe build page.
function makeNextData() {
  return {
    props: {
      pageProps: {
        data: {
          title: "Test Saryn Build",
          name: "Saryn Prime",
          formas: 4,
          slots: [
            { slot_id: 1, mod: 12345, rank: 5, polarity: 1 },
            { slot_id: 2, mod: 0, rank: 0, polarity: 0 },
            { slot_id: 9, mod: 67890, rank: 3, polarity: 2 },
          ],
        },
      },
    },
  }
}

function htmlWith(nextData: unknown): string {
  return `<!doctype html><html><body><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
    nextData,
  )}</script></body></html>`
}

afterEach(() => vi.clearAllMocks())

describe("isValidOverframeBuildUrl", () => {
  it("accepts overframe build URLs and rejects everything else", () => {
    expect(isValidOverframeBuildUrl(BUILD_URL)).toBe(true)
    expect(isValidOverframeBuildUrl("https://overframe.gg/build/1")).toBe(true)
    expect(isValidOverframeBuildUrl("https://overframe.gg/builds/1")).toBe(
      false,
    )
    expect(isValidOverframeBuildUrl("https://evil.com/build/1")).toBe(false)
    expect(isValidOverframeBuildUrl("not a url")).toBe(false)
  })
})

describe("scrapeOverframeFromNextData", () => {
  it("extracts item, forma, and slots from a pasted __NEXT_DATA__ object", () => {
    const res = scrapeOverframeFromNextData(makeNextData(), BUILD_URL)

    expect(res.warnings).toEqual([])
    expect(res.itemName).toBe("Saryn Prime")
    expect(res.formaCount).toBe(4)
    expect(res.source.buildId).toBe("1005502")
    expect(res.source.url).toBe(BUILD_URL)
    expect(res.slots).toHaveLength(3)

    const byId = Object.fromEntries(res.slots.map((s) => [s.slot_id, s]))
    expect(byId[1]).toMatchObject({ overframeId: "12345", rank: 5 })
    expect(byId[1].polarity).toBe("madurai") // code 1
    expect(byId[2].overframeId).toBeNull() // empty slot (mod 0)
    expect(byId[9].polarity).toBe("vazarin") // code 2
  })

  it('maps polarity code 9 to "any" (Universal forma), not zenurik', () => {
    // The Universal ("Any") forma matches every mod, so Overframe still reports
    // polarity_match === 2 for it — which is how code 9 was once mis-read as
    // zenurik. It must map to "any" (matches everything, doubles aura), NOT
    // "universal" (which means "slot cleared" in calculations.ts). See
    // polarity.ts.
    const nextData = {
      props: {
        pageProps: {
          data: {
            title: "T",
            name: "Voruna Prime",
            formas: 5,
            slots: [{ slot_id: 9, mod: 303, rank: 5, polarity: 9 }],
          },
        },
      },
    }
    const res = scrapeOverframeFromNextData(nextData, BUILD_URL)
    expect(res.slots[0].polarity).toBe("any")
    expect(res.slots[0].polarityCode).toBe(9)
  })

  it("prefers the plain data.description guide over the link-marked guideMarkdown", () => {
    const nextData = {
      props: {
        pageProps: {
          guideMarkdown:
            "Use [\\[Hunt\\]](/items/arsenal/213/hunt/) early then nuke.",
          data: {
            title: "T",
            name: "Voruna Prime",
            formas: 5,
            description: "Use Hunt early then nuke.",
            slots: [{ slot_id: 1, mod: 1, rank: 0, polarity: 0 }],
          },
        },
      },
    }
    const res = scrapeOverframeFromNextData(nextData, BUILD_URL)
    expect(res.source.guideDescription).toBe("Use Hunt early then nuke.")
  })

  it("keeps a valid url but ignores a non-overframe one", () => {
    expect(
      scrapeOverframeFromNextData(makeNextData(), BUILD_URL).source.url,
    ).toBe(BUILD_URL)
    expect(
      scrapeOverframeFromNextData(makeNextData(), "https://evil.com/x").source
        .url,
    ).toBe("")
    expect(scrapeOverframeFromNextData(makeNextData()).source.url).toBe("")
  })

  it("warns instead of throwing on empty/garbage data", () => {
    const res = scrapeOverframeFromNextData(null, BUILD_URL)
    expect(res.slots).toHaveLength(0)
    expect(res.warnings.map((w) => w.type)).toContain("next_data_missing")
  })
})

describe("scrapeOverframeBuild (fetch path)", () => {
  it("returns a friendly Cloudflare message on a 403", async () => {
    vi.mocked(safeFetch).mockRejectedValueOnce(
      new SafeFetchError("upstream_status", 403),
    )

    const res = await scrapeOverframeBuild(BUILD_URL)
    const warning = res.warnings.find((w) => w.type === "fetch_failed")

    expect(warning).toBeDefined()
    expect(warning?.message).toMatch(/Cloudflare bot protection/i)
    expect(warning?.message).not.toMatch(/HTTP 403/) // no raw status leak
  })

  it("still surfaces other upstream statuses verbatim", async () => {
    vi.mocked(safeFetch).mockRejectedValueOnce(
      new SafeFetchError("upstream_status", 500),
    )

    const res = await scrapeOverframeBuild(BUILD_URL)
    expect(
      res.warnings.find((w) => w.type === "fetch_failed")?.message,
    ).toMatch(/HTTP 500/)
  })

  it("extracts a build from fetched HTML", async () => {
    vi.mocked(safeFetch).mockResolvedValueOnce(
      new Response(htmlWith(makeNextData())),
    )

    const res = await scrapeOverframeBuild(BUILD_URL)
    expect(res.itemName).toBe("Saryn Prime")
    expect(res.slots).toHaveLength(3)
    expect(res.warnings).toEqual([])
  })

  it("rejects a non-overframe URL before fetching", async () => {
    const res = await scrapeOverframeBuild("https://evil.com/build/1")
    expect(res.warnings[0]?.type).toBe("invalid_url")
    expect(safeFetch).not.toHaveBeenCalled()
  })
})

// The raw route handler is thin glue over parseJsonBody + scrapeOverframeFromNextData.
// Test it with a fake Context (same shim style as validate.test.ts) so we cover
// the request validation without standing up Hono / the DB-backed rate limiter.
async function importHandler() {
  return (await import("../../routes/imports")).handleOverframeRawImport
}

function fakeJsonContext(body: unknown): {
  c: Context
  captured: { body: unknown; status: number }
} {
  const raw = new Request("https://test.local/", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  const captured = { body: undefined as unknown, status: 200 }
  const c = {
    req: { header: (n: string) => raw.headers.get(n) ?? undefined, raw },
    json: (b: unknown, status = 200) => {
      captured.body = b
      captured.status = status
      return new Response(JSON.stringify(b), { status })
    },
  } as unknown as Context
  return { c, captured }
}

describe("handleOverframeRawImport", () => {
  // Default to a signed-in caller; the 401 case overrides per-test.
  beforeEach(() => {
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u1" },
    } as never)
  })

  it("401s when the caller isn't signed in", async () => {
    vi.mocked(getSession).mockResolvedValue(null as never)
    const handle = await importHandler()
    const { c, captured } = fakeJsonContext({
      source: "arsenyx-overframe",
      url: BUILD_URL,
      nextData: makeNextData(),
    })
    await handle(c)
    expect(captured.status).toBe(401)
    expect(captured.body).toMatchObject({ error: "unauthorized" })
  })

  it("400s when nextData is missing", async () => {
    const handle = await importHandler()
    const { c, captured } = fakeJsonContext({ url: BUILD_URL })
    await handle(c)
    expect(captured.status).toBe(400)
    expect(captured.body).toMatchObject({ error: "missing_next_data" })
  })

  it("returns a scrape response for a valid paste", async () => {
    const handle = await importHandler()
    const { c, captured } = fakeJsonContext({
      source: "arsenyx-overframe",
      url: BUILD_URL,
      nextData: makeNextData(),
    })
    await handle(c)
    expect(captured.status).toBe(200)
    expect(captured.body).toMatchObject({ itemName: "Saryn Prime" })
  })
})
