import { beforeEach, describe, expect, it, vi } from "vitest"

import {
  AUTHORED_PUBLIC_BUILD,
  bookmarkedScope,
  canActOnBuild,
  canDeleteBuild,
  canMutateBuild,
  resolveAccess,
  userPublicScope,
} from "./_build-visibility"

// Membership rows the access checks may look up: "member" belongs to org1,
// "orgAdmin" is its ADMIN.
const ROLES: Record<string, "ADMIN" | "MEMBER"> = {
  member: "MEMBER",
  orgAdmin: "ADMIN",
}
const lookups: { organizationId: string; userId: string }[] = []
// org1's deletion settings, as the organizations row holds them.
const org1 = {
  membersDeleteOwnBuilds: false,
  authorGraceMinutes: null as number | null,
}
const policyLookups: string[] = []
vi.mock("../db", () => ({
  prisma: {
    organization: {
      findUnique: async ({ where }: { where: { id: string } }) => {
        policyLookups.push(where.id)
        return where.id === "org1" ? org1 : null
      },
    },
    organizationMember: {
      findUnique: async ({
        where,
      }: {
        where: {
          organizationId_userId: { organizationId: string; userId: string }
        }
      }) => {
        const key = where.organizationId_userId
        lookups.push(key)
        const role = key.organizationId === "org1" && ROLES[key.userId]
        return role ? { role } : null
      },
    },
  },
}))

beforeEach(() => {
  lookups.length = 0
  policyLookups.length = 0
  org1.membersDeleteOwnBuilds = false
  org1.authorGraceMinutes = null
})

const orgBuild = (visibility: "PUBLIC" | "UNLISTED" | "PRIVATE") => ({
  userId: "owner",
  organizationId: "org1",
  visibility,
})

describe("per-build access with membership resolved", () => {
  it("lets an org member mutate a co-member's build; a stranger can't", async () => {
    expect(await canMutateBuild(orgBuild("PRIVATE"), "member")).toBe(true)
    expect(await canMutateBuild(orgBuild("PRIVATE"), "stranger")).toBe(false)
  })

  it("never looks up the author's own membership", async () => {
    expect(await canMutateBuild(orgBuild("PRIVATE"), "owner")).toBe(true)
    expect(lookups).toEqual([])
  })

  it("never looks up membership for an anonymous viewer", async () => {
    expect(await canActOnBuild(orgBuild("PRIVATE"), undefined)).toBe(false)
    expect((await resolveAccess(orgBuild("PRIVATE"), undefined)).canView).toBe(
      false,
    )
    expect(lookups).toEqual([])
  })

  it("skips the lookup when visibility alone allows acting", async () => {
    expect(await canActOnBuild(orgBuild("UNLISTED"), "stranger")).toBe(true)
    expect(lookups).toEqual([])
  })

  it("lets an org member act on the org's PRIVATE build", async () => {
    expect(await canActOnBuild(orgBuild("PRIVATE"), "member")).toBe(true)
  })

  it("lets an admin view a PRIVATE build but not act on or mutate it", async () => {
    const access = await resolveAccess(orgBuild("PRIVATE"), {
      id: "admin",
      isAdmin: true,
    })
    expect(access).toEqual({
      canView: true,
      canAct: false,
      canMutate: false,
      canDelete: false,
    })
    expect(await canActOnBuild(orgBuild("PRIVATE"), "admin")).toBe(false)
  })

  it("lets only org admins delete an org build, the author included", async () => {
    expect(await canDeleteBuild(orgBuild("PUBLIC"), "orgAdmin")).toBe(true)
    expect(await canDeleteBuild(orgBuild("PUBLIC"), "owner")).toBe(false)
    expect(await canDeleteBuild(orgBuild("PUBLIC"), "member")).toBe(false)
    expect(await canDeleteBuild(orgBuild("PUBLIC"), "stranger")).toBe(false)
    expect(
      (await resolveAccess(orgBuild("PUBLIC"), { id: "orgAdmin" })).canDelete,
    ).toBe(true)
    expect(
      (await resolveAccess(orgBuild("PUBLIC"), { id: "owner" })).canDelete,
    ).toBe(false)
  })

  it("reads the org's policy only for the author", async () => {
    await canDeleteBuild(orgBuild("PUBLIC"), "orgAdmin")
    await canDeleteBuild(orgBuild("PUBLIC"), "member")
    expect(policyLookups).toEqual([])
    await canDeleteBuild(orgBuild("PUBLIC"), "owner")
    expect(policyLookups).toEqual(["org1"])
  })

  it("lets a member delete their own build when the org allows it", async () => {
    org1.membersDeleteOwnBuilds = true
    const own = { ...orgBuild("PUBLIC"), userId: "member" }
    expect(await canDeleteBuild(own, "member")).toBe(true)
    expect(await canDeleteBuild(own, "orgAdmin")).toBe(true)
    // Another member's build, or an author who isn't a member any more.
    expect(await canDeleteBuild(orgBuild("PUBLIC"), "member")).toBe(false)
    expect(await canDeleteBuild(orgBuild("PUBLIC"), "owner")).toBe(false)
  })

  it("uses the org's grace length", async () => {
    const recent = {
      ...orgBuild("PUBLIC"),
      organizationSince: new Date(Date.now() - 30 * 60_000),
    }
    expect(await canDeleteBuild(recent, "owner")).toBe(true)
    org1.authorGraceMinutes = 0
    expect(await canDeleteBuild(recent, "owner")).toBe(false)
  })

  it("lets the author alone delete a solo build, without a lookup", async () => {
    const solo = { userId: "owner", organizationId: null }
    expect(await canDeleteBuild(solo, "owner")).toBe(true)
    expect(await canDeleteBuild(solo, "orgAdmin")).toBe(false)
    expect(lookups).toEqual([])
    expect(policyLookups).toEqual([])
  })

  it("grants nothing through membership on a build with no org", async () => {
    const solo = {
      userId: "owner",
      organizationId: null,
      visibility: "PRIVATE" as const,
    }
    expect(await canMutateBuild(solo, "member")).toBe(false)
    expect(lookups).toEqual([])
  })
})

// The profile directory (`GET /users`) filters and counts by
// AUTHORED_PUBLIC_BUILD; the profile page lists and aggregates by
// userPublicScope's SQL. If the two ever disagree, the directory lists authors
// whose profile renders empty — silent, and only visible against a database
// with org-published builds.
describe("authored public builds", () => {
  // Evaluates the Prisma where against a row, for the two shapes it uses
  // (equality and OR), so the cases below pin the rule rather than restate it.
  type Row = Record<string, unknown>
  const admits = (where: Row, row: Row): boolean =>
    Object.entries(where).every(([k, v]) =>
      k === "OR" ? (v as Row[]).some((w) => admits(w, row)) : row[k] === v,
    )
  const row = (over: Row): Row => ({
    visibility: "PUBLIC",
    organizationId: "org1",
    hideAuthor: false,
    ...over,
  })

  it("admits an org build only when it isn't hiding its author", () => {
    expect(admits(AUTHORED_PUBLIC_BUILD, row({}))).toBe(true)
    expect(admits(AUTHORED_PUBLIC_BUILD, row({ hideAuthor: true }))).toBe(false)
    // An orphaned hideAuthor (its org was deleted) no longer hides anything.
    expect(
      admits(
        AUTHORED_PUBLIC_BUILD,
        row({ organizationId: null, hideAuthor: true }),
      ),
    ).toBe(true)
    expect(admits(AUTHORED_PUBLIC_BUILD, row({ visibility: "UNLISTED" }))).toBe(
      false,
    )
  })

  it("applies the same rule in SQL, with the userId bound as a parameter", () => {
    const { text, values } = userPublicScope("user_abc").baseFilter
    expect(values).toEqual(["user_abc"])
    expect(text).not.toContain("user_abc")
    expect(text).toContain(`visibility = 'PUBLIC'`)
    expect(text).toContain(`("organizationId" IS NULL OR "hideAuthor" = false)`)
  })
})

describe("bookmarkedScope", () => {
  it("keeps anonymously visible bookmarks plus the user's own, userId bound", () => {
    const { text, values } = bookmarkedScope("user_abc").baseFilter
    expect(values).toEqual(["user_abc", "user_abc"])
    expect(text).not.toContain("user_abc")
    expect(text).toContain(`visibility IN ('PUBLIC', 'UNLISTED')`)
  })
})
