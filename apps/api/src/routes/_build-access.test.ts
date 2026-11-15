import { describe, expect, it } from "vitest"

import { visibleAuthor } from "./_build-list"
import { buildAccess } from "./_build-visibility"

const OWNER = "owner"

describe("buildAccess", () => {
  const cases = [
    // visibility, viewer, isOrgMember, isAdmin → view, act, mutate
    ["PUBLIC", undefined, false, false, true, true, false],
    ["UNLISTED", undefined, false, false, true, true, false],
    ["PRIVATE", undefined, false, false, false, false, false],
    ["PRIVATE", "stranger", false, false, false, false, false],
    ["PRIVATE", OWNER, false, false, true, true, true],
    ["PRIVATE", "member", true, false, true, true, true],
    ["PUBLIC", "member", true, false, true, true, true],
    ["PUBLIC", "stranger", false, false, true, true, false],
    // Admins may view a private build to moderate it, but never act on it.
    ["PRIVATE", "admin", false, true, true, false, false],
    // Org membership without a signed-in viewer grants nothing.
    ["PRIVATE", undefined, true, false, false, false, false],
  ] as const

  it.each(cases)(
    "%s build, viewer %s (member=%s, admin=%s)",
    (visibility, id, isOrgMember, isAdmin, view, act, mutate) => {
      expect(
        buildAccess(
          { userId: OWNER, organizationId: "org", visibility },
          { id, isOrgMember, isAdmin },
        ),
      ).toMatchObject({ canView: view, canAct: act, canMutate: mutate })
    },
  )
})

describe("buildAccess canDelete", () => {
  const cases = [
    // org, viewer, isOrgMember, isOrgAdmin, isAdmin → canDelete
    // A solo build: its author alone.
    [null, OWNER, false, false, false, true],
    [null, "stranger", false, false, false, false],
    [null, "admin", false, false, true, false],
    // An org build: org ADMINs alone, whoever wrote it.
    ["org", OWNER, true, false, false, false],
    ["org", OWNER, false, false, false, false],
    ["org", OWNER, true, true, false, true],
    ["org", "member", true, false, false, false],
    ["org", "orgAdmin", true, true, false, true],
    ["org", "admin", false, false, true, false],
    ["org", undefined, true, true, false, false],
  ] as const

  it.each(cases)(
    "org=%s, viewer %s (member=%s, orgAdmin=%s, admin=%s)",
    (organizationId, id, isOrgMember, isOrgAdmin, isAdmin, canDelete) => {
      expect(
        buildAccess(
          { userId: OWNER, organizationId, visibility: "PUBLIC" },
          { id, isOrgMember, isOrgAdmin, isAdmin },
        ).canDelete,
      ).toBe(canDelete)
    },
  )
})

describe("buildAccess grace period", () => {
  const now = Date.now()
  const joined = (minutesAgo: number | null) => ({
    userId: OWNER,
    organizationId: "org",
    organizationSince:
      minutesAgo === null ? null : new Date(now - minutesAgo * 60_000),
    visibility: "PUBLIC" as const,
  })
  const canDelete = (minutesAgo: number | null, id: string) =>
    buildAccess(joined(minutesAgo), {
      id,
      isOrgMember: true,
      isOrgAdmin: false,
    }).canDelete

  it("lets the author take a build back within the hour after it joined", () => {
    expect(canDelete(5, OWNER)).toBe(true)
    expect(canDelete(59, OWNER)).toBe(true)
  })

  it("closes after the hour, and never opened for builds tagged before", () => {
    expect(canDelete(61, OWNER)).toBe(false)
    expect(canDelete(null, OWNER)).toBe(false)
  })

  it("gives other members nothing within it", () => {
    expect(canDelete(5, "member")).toBe(false)
  })
})

describe("visibleAuthor", () => {
  const user = { id: "u1", name: "Real Name" }
  const org = { id: "o1" }

  it("hides the author of a hideAuthor org build", () => {
    expect(
      visibleAuthor({ hideAuthor: true, organization: org, user }).id,
    ).toBe("")
  })

  it("reveals the author to owners and admins", () => {
    expect(
      visibleAuthor({ hideAuthor: true, organization: org, user }, true),
    ).toBe(user)
  })

  it("ignores a stale hideAuthor flag on a build with no org", () => {
    expect(visibleAuthor({ hideAuthor: true, organization: null, user })).toBe(
      user,
    )
  })
})
