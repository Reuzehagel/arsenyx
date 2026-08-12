import { describe, expect, it } from "vitest"

import { AUTHORED_PUBLIC_BUILD, userPublicScope } from "./_build-visibility"

// The profile directory (`GET /users`) filters and counts by
// AUTHORED_PUBLIC_BUILD; the profile page lists and aggregates by
// userPublicScope. If the two ever disagree, the directory lists authors whose
// profile renders empty, or prints a build count the profile contradicts —
// both silent, and only visible against a database with org-published builds.
// So pin that one is literally the other plus a userId.
describe("AUTHORED_PUBLIC_BUILD", () => {
  it("is userPublicScope's baseWhere with the userId removed", () => {
    const { userId, ...buildHalf } = userPublicScope("user_abc").baseWhere as {
      userId: string
    } & Record<string, unknown>

    expect(userId).toBe("user_abc")
    expect(buildHalf).toEqual({ ...AUTHORED_PUBLIC_BUILD })
  })

  it("admits an org build only when it isn't hiding its author", () => {
    // Not a tautology restating the source: this is the #317 rule the
    // directory filter now depends on. A user whose only builds are
    // hideAuthor org builds must not appear in the directory.
    expect(AUTHORED_PUBLIC_BUILD.OR).toEqual([
      { organizationId: null },
      { hideAuthor: false },
    ])
    expect(AUTHORED_PUBLIC_BUILD.visibility).toBe("PUBLIC")
  })
})
