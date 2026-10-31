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
          { userId: OWNER, visibility },
          { id, isOrgMember, isAdmin },
        ),
      ).toEqual({ canView: view, canAct: act, canMutate: mutate })
    },
  )
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
