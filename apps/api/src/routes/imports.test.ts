import { beforeEach, describe, expect, it, vi } from "vitest"

import { imports } from "./imports"

// Driven through the real router (requireUser, parseJsonBody, error
// responses), with Better Auth's session lookup stubbed and the DB-backed
// limiter passed through so no Postgres is needed.
const getSession = vi.hoisted(() => vi.fn())
vi.mock("../auth", () => ({ auth: { api: { getSession } } }))
vi.mock("../middleware/rate-limit", () => ({
  rateLimitUser: () => async (_c: unknown, next: () => Promise<void>) => next(),
}))

const BUILD_URL = "https://overframe.gg/build/1005502/saryn-prime"
const nextData = {
  props: { pageProps: { data: { name: "Saryn Prime", slots: [] } } },
}

const post = (body: unknown) =>
  imports.request("/overframe/raw", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })

describe("POST /imports/overframe/raw", () => {
  beforeEach(() => {
    getSession.mockResolvedValue({ user: { id: "u1" } } as never)
  })

  it("401s when the caller isn't signed in", async () => {
    getSession.mockResolvedValue(null)
    const res = await post({ url: BUILD_URL, nextData })
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: "unauthorized" })
  })

  it("400s when nextData is missing", async () => {
    const res = await post({ url: BUILD_URL })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "missing_next_data" })
  })

  it("400s on a body that isn't JSON", async () => {
    const res = await imports.request("/overframe/raw", {
      method: "POST",
      body: "{nope",
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "invalid_json" })
  })

  it("returns a scrape response for a valid paste", async () => {
    const res = await post({ url: BUILD_URL, nextData })
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({
      itemName: "Saryn Prime",
      source: { url: BUILD_URL, buildId: "1005502" },
    })
  })
})
