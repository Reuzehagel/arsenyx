import type { BuildDetailResponse } from "@arsenyx/shared/api/build-dto"
import { Hono } from "hono"
import { afterEach, describe, expect, it, vi } from "vitest"

import {
  detailCachePaths,
  detailVariant,
  metaFromSnapshot,
  invalidateBuilds,
  SNAPSHOT_TTL,
  snapshotKey,
  writeSnapshot,
  type Snapshot,
} from "./_build-snapshot"

// No database: a refresh's reload finds nothing (the build was deleted or
// went PRIVATE), so it must drop the key.
vi.mock("../db", () => ({
  prisma: { build: { findUnique: async () => null } },
  registerBackgroundWork: (p: Promise<unknown>) => void p.catch(() => {}),
}))

function fakeKv() {
  const store = new Map<string, { value: string; opts: unknown }>()
  const deleted: string[] = []
  const kv = {
    put: async (k: string, value: string, opts: unknown) => {
      store.set(k, { value, opts })
    },
    delete: async (k: string) => {
      deleted.push(k)
      store.delete(k)
    },
  } as unknown as KVNamespace
  return { kv, store, deleted }
}

const snap = (visibility: string): Snapshot =>
  ({
    body: { slug: "abc", visibility },
    meta: { id: "id1", visibility },
  }) as Snapshot

describe("writeSnapshot", () => {
  it("stores PUBLIC and UNLISTED builds with the TTL and metadata", async () => {
    for (const v of ["PUBLIC", "UNLISTED"]) {
      const { kv, store } = fakeKv()
      await writeSnapshot(kv, "abc", snap(v))
      const entry = store.get(snapshotKey("abc"))
      expect(JSON.parse(entry!.value)).toEqual({ slug: "abc", visibility: v })
      expect(entry!.opts).toEqual({
        expirationTtl: SNAPSHOT_TTL,
        metadata: { id: "id1", visibility: v },
      })
    }
  })

  it("never stores a PRIVATE build, and drops any existing key", async () => {
    const { kv, store, deleted } = fakeKv()
    await writeSnapshot(kv, "abc", snap("PUBLIC"))
    await writeSnapshot(kv, "abc", snap("PRIVATE"))
    expect(store.size).toBe(0)
    expect(deleted).toEqual([snapshotKey("abc")])
  })

  it("drops the key for a missing (deleted) build", async () => {
    const { kv, store, deleted } = fakeKv()
    await writeSnapshot(kv, "abc", snap("PUBLIC"))
    await writeSnapshot(kv, "abc", null)
    expect(store.size).toBe(0)
    expect(deleted).toEqual([snapshotKey("abc")])
  })
})

describe("detail variants", () => {
  // The purge list and the handler's dispatch come from one table: every URL
  // invalidateBuilds evicts must be a variant the handler serves, and every
  // variant must be evicted. `meta` twice: the legacy `?embed=1` alias.
  it("purges every URL the handler serves a variant on", () => {
    const served = detailCachePaths("abc").map((path) => {
      const url = new URL(path, "http://api.test")
      expect(url.pathname).toBe("/builds/abc")
      return detailVariant({
        req: { query: (k: string) => url.searchParams.get(k) ?? undefined },
      } as never)
    })
    expect(served.sort()).toEqual(["full", "meta", "meta", "noView"])
  })
})

describe("invalidateBuilds", () => {
  afterEach(() => {
    delete (globalThis as { caches?: unknown }).caches
  })

  it("evicts every detail variant and drops the snapshot of a build that's gone", async () => {
    const evicted: string[] = []
    ;(globalThis as { caches?: unknown }).caches = {
      default: {
        delete: async (req: Request) => {
          evicted.push(req.url)
          return true
        },
      },
    }
    const { kv, deleted } = fakeKv()
    const app = new Hono()
    app.post("/x", (c) => {
      invalidateBuilds(c, ["abc", "abc"])
      return c.body(null, 204)
    })
    await app.request(
      "http://api.test/x",
      { method: "POST" },
      {
        BUILD_SNAPSHOTS: kv,
      },
    )

    expect(evicted.sort()).toEqual(
      [
        "http://api.test/builds/abc",
        "http://api.test/builds/abc?embed=1",
        "http://api.test/builds/abc?meta=1",
        "http://api.test/builds/abc?view=0",
      ].sort(),
    )
    await vi.waitFor(() => expect(deleted).toEqual([snapshotKey("abc")]))
  })
})

describe("metaFromSnapshot", () => {
  const full = {
    id: "id1",
    slug: "abc",
    name: "Build",
    description: "d",
    visibility: "PUBLIC",
    item: { uniqueName: "u", category: "c", name: "n", imageName: "i" },
    buildData: { big: true },
    hideAuthor: false,
    likeCount: 3,
    viewCount: 9,
    user: {
      id: "u1",
      name: "N",
      username: "nick",
      displayUsername: "Nick",
      image: "x.png",
    },
    organization: {
      id: "o1",
      name: "Org",
      slug: "org",
      image: null,
      verified: true,
    },
    guide: { summary: "s", description: "long", updatedAt: "t" },
    partners: [],
  } as unknown as BuildDetailResponse

  it("keeps the unfurl fields and drops the loadout, guide body and author id", () => {
    const e = metaFromSnapshot(full)
    expect(e).toMatchObject({
      name: "Build",
      likeCount: 3,
      user: { name: "N", username: "nick", displayUsername: "Nick" },
      organization: { name: "Org", verified: true },
      guide: { summary: "s" },
    })
    const json = JSON.stringify(e)
    for (const leaked of ["big", "long", "u1", "x.png", "partners"]) {
      expect(json).not.toContain(leaked)
    }
  })

  it("keeps a redacted author redacted", () => {
    const hidden = {
      id: "",
      name: null,
      username: null,
      displayUsername: null,
      image: null,
    }
    const e = metaFromSnapshot({ ...full, hideAuthor: true, user: hidden })
    expect(e.user).toEqual(hidden)
  })

  it("null org and guide", () => {
    const e = metaFromSnapshot({ ...full, organization: null, guide: null })
    expect(e.organization).toBeNull()
    expect(e.guide).toBeNull()
  })
})
