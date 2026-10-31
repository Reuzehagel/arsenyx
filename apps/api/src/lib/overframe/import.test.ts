import type { Context } from "hono"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

// The raw route handler is now sign-in-gated; stub getSession so handler tests
// can simulate signed-in (default) and signed-out callers without Better Auth.
vi.mock("../../lib/session", () => ({ getSession: vi.fn() }))

import { getSession } from "../../lib/session"
import { parseOverframeBuildUrl, scrapeOverframeFromNextData } from "./import"

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

afterEach(() => vi.clearAllMocks())

describe("parseOverframeBuildUrl", () => {
  it("accepts overframe build URLs and rejects everything else", () => {
    expect(parseOverframeBuildUrl(BUILD_URL) !== null).toBe(true)
    expect(
      parseOverframeBuildUrl("https://overframe.gg/build/1") !== null,
    ).toBe(true)
    expect(
      parseOverframeBuildUrl("https://overframe.gg/builds/1") !== null,
    ).toBe(false)
    expect(parseOverframeBuildUrl("https://evil.com/build/1") !== null).toBe(
      false,
    )
    expect(parseOverframeBuildUrl("not a url") !== null).toBe(false)
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

  it("maps polarity code 4 to zenurik", () => {
    // Confirmed via Prey of Dynar (a zenurik augment) sitting in a code-4 slot
    // with polarity_match === 2. Code 4 was previously unmapped, so the slot's
    // zenurik forma was silently dropped and the forma count came up short.
    const nextData = {
      props: {
        pageProps: {
          data: {
            title: "T",
            name: "Voruna Prime",
            formas: 5,
            slots: [{ slot_id: 3, mod: 6745, rank: 3, polarity: 4 }],
          },
        },
      },
    }
    const res = scrapeOverframeFromNextData(nextData, BUILD_URL)
    expect(res.slots[0].polarity).toBe("zenurik")
    expect(res.slots[0].polarityCode).toBe(4)
  })

  it("maps polarity code 8 to umbra", () => {
    // Confirmed via Umbral Vitality / Umbral Intensify (umbra mods) in code-8
    // slots. Previously unmapped, so an umbra-forma'd slot imported as a
    // spurious "universal" (cleared) forma and the count came up short.
    const nextData = {
      props: {
        pageProps: {
          data: {
            title: "T",
            name: "Valkyr Prime",
            formas: 5,
            slots: [{ slot_id: 6, mod: 695, rank: 10, polarity: 8 }],
          },
        },
      },
    }
    const res = scrapeOverframeFromNextData(nextData, BUILD_URL)
    expect(res.slots[0].polarity).toBe("umbra")
    expect(res.slots[0].polarityCode).toBe(8)
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
