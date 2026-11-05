import { beforeEach, describe, expect, it, vi } from "vitest"

import { auth } from "./auth"
import app from "./index"
import { getSession } from "./lib/session"
import { invalidateBuilds, snapshotSlugs } from "./routes/builds"

// Pins the account-change middleware in src/index.ts. Registered after the
// /auth/* handler, Hono would skip it silently and a deleted user's builds
// would stay public in KV for SNAPSHOT_TTL (24 h).

vi.mock("./auth", async (orig) => {
  const m = await orig<typeof import("./auth")>()
  return { ...m, auth: { ...m.auth, handler: vi.fn() } }
})
vi.mock("./lib/session", () => ({ getSession: vi.fn() }))
vi.mock("./routes/builds", async (orig) => ({
  ...(await orig<typeof import("./routes/builds")>()),
  invalidateBuilds: vi.fn(),
  snapshotSlugs: vi.fn(),
}))

const ctx = {
  waitUntil() {},
  passThroughOnException() {},
} as unknown as ExecutionContext

const post = (path: string) =>
  app.fetch(new Request(`http://api.test${path}`, { method: "POST" }), {}, ctx)

describe("account changes refresh build snapshots", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getSession).mockResolvedValue({
      user: { id: "u1" },
    } as Awaited<ReturnType<typeof getSession>>)
    vi.mocked(snapshotSlugs).mockResolvedValue(["a", "b"])
  })

  for (const path of ["/auth/delete-user", "/auth/update-user"]) {
    it(`${path}: invalidates the user's builds after success`, async () => {
      vi.mocked(auth.handler).mockResolvedValue(new Response("{}"))
      await post(path)
      expect(snapshotSlugs).toHaveBeenCalledWith({ userId: "u1" })
      expect(invalidateBuilds).toHaveBeenCalledWith(expect.anything(), [
        "a",
        "b",
      ])
    })

    it(`${path}: leaves snapshots alone when the auth call fails`, async () => {
      vi.mocked(auth.handler).mockResolvedValue(
        new Response("{}", { status: 400 }),
      )
      await post(path)
      expect(invalidateBuilds).not.toHaveBeenCalled()
    })
  }
})
