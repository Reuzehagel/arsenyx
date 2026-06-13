import { describe, expect, it } from "vitest"

import {
  buildAuthor,
  buildMetaTitle,
  buildOgType,
  type BuildTitleInput,
} from "./build-meta"

const base: BuildTitleInput = {
  item: { name: "Frumentarius" },
  hideAuthor: false,
  organization: null,
  user: { displayUsername: null, username: null, name: null },
}

describe("buildAuthor", () => {
  it("prefers the organization over the user", () => {
    expect(
      buildAuthor({
        ...base,
        organization: { name: "Profit Taker" },
        user: { displayUsername: "dev", username: "dev1", name: "Dev" },
      }),
    ).toBe("Profit Taker")
  })

  it("falls back display username → username → name", () => {
    expect(
      buildAuthor({
        ...base,
        user: { displayUsername: "Display", username: "uname", name: "Name" },
      }),
    ).toBe("Display")
    expect(
      buildAuthor({
        ...base,
        user: { displayUsername: null, username: "uname", name: "Name" },
      }),
    ).toBe("uname")
    expect(
      buildAuthor({
        ...base,
        user: { displayUsername: null, username: null, name: "Name" },
      }),
    ).toBe("Name")
  })

  it("returns null when nothing is set", () => {
    expect(buildAuthor(base)).toBeNull()
  })

  it("hideAuthor shows the org only, never the user", () => {
    expect(
      buildAuthor({
        ...base,
        hideAuthor: true,
        organization: { name: "Profit Taker" },
        user: { displayUsername: "dev", username: "dev1", name: "Dev" },
      }),
    ).toBe("Profit Taker")
  })

  it("hideAuthor with no org returns null (does not leak the user)", () => {
    expect(
      buildAuthor({
        ...base,
        hideAuthor: true,
        user: { displayUsername: "dev", username: "dev1", name: "Dev" },
      }),
    ).toBeNull()
  })
})

describe("buildMetaTitle", () => {
  it("includes the author when present (no site suffix)", () => {
    expect(
      buildMetaTitle({ ...base, organization: { name: "Profit Taker" } }),
    ).toBe("Frumentarius Build by Profit Taker")
  })

  it("omits the 'by …' clause when there is no author", () => {
    expect(buildMetaTitle(base)).toBe("Frumentarius Build")
  })
})

describe("buildOgType", () => {
  it("is article only for PUBLIC builds", () => {
    expect(buildOgType("PUBLIC")).toBe("article")
    expect(buildOgType("UNLISTED")).toBe("website")
    expect(buildOgType("PRIVATE")).toBe("website")
  })
})
