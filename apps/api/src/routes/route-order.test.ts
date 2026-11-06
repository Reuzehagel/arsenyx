import { describe, expect, it, vi } from "vitest"

import { builds } from "./builds"
import { orgs } from "./orgs"

// Hono matches in registration order, so a literal segment registered after a
// param route on the same shape is unreachable. These pin the two places that
// rely on order; each request would get a different status from the param
// route that would otherwise capture it.

vi.mock("../auth", () => ({
  auth: { api: { getSession: async () => ({ user: { id: "u1" } }) } },
}))
vi.mock("../middleware/rate-limit", () => ({
  rateLimitUser: () => async (_c: unknown, next: () => Promise<void>) => next(),
  enforceAnonSearchLimit: async () => null,
}))
vi.mock("../db", () => ({
  prisma: {
    build: { findUnique: async () => null },
    organization: {
      findUnique: async () => null,
      findMany: async () => [],
      count: async () => 0,
    },
  },
}))

describe("route registration order", () => {
  it("PUT /builds/:slug/partners/order is not captured as a partnerSlug", async () => {
    // The order handler validates the body before any lookup; the
    // /:partnerSlug link handler would 404 on the missing builds instead.
    const res = await builds.request("/abc/partners/order", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ order: "not-a-list" }),
    })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: "invalid_order" })
  })

  it("GET /orgs/public is the directory, not an org named 'public'", async () => {
    const res = await orgs.request("/public")
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ orgs: [], total: 0 })
  })
})
