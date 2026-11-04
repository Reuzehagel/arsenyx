import { describe, expect, it } from "vitest"

import {
  embedFromSnapshot,
  isAnonVisible,
  SNAPSHOT_TTL,
  snapshotKey,
  writeSnapshot,
  type Snapshot,
} from "./_build-snapshot"

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

describe("isAnonVisible", () => {
  it("only PUBLIC and UNLISTED", () => {
    expect(isAnonVisible("PUBLIC")).toBe(true)
    expect(isAnonVisible("UNLISTED")).toBe(true)
    expect(isAnonVisible("PRIVATE")).toBe(false)
  })
})

describe("embedFromSnapshot", () => {
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
  }

  it("matches the old slim query's shape", () => {
    expect(embedFromSnapshot(full)).toEqual({
      name: "Build",
      description: "d",
      visibility: "PUBLIC",
      hideAuthor: false,
      likeCount: 3,
      viewCount: 9,
      item: full.item,
      user: { name: "N", username: "nick", displayUsername: "Nick" },
      organization: { name: "Org", verified: true },
      guide: { summary: "s" },
    })
  })

  it("keeps a redacted author redacted", () => {
    const hidden = {
      id: "",
      name: null,
      username: null,
      displayUsername: null,
      image: null,
    }
    const e = embedFromSnapshot({ ...full, hideAuthor: true, user: hidden })
    expect(e.user).toEqual(hidden)
  })

  it("null org and guide", () => {
    const e = embedFromSnapshot({ ...full, organization: null, guide: null })
    expect(e.organization).toBeNull()
    expect(e.guide).toBeNull()
  })
})
