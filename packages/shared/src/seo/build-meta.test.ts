import { describe, expect, it } from "vitest"

import {
  buildAuthor,
  buildMetaDescription,
  buildMetaTitle,
  resolveBuildImage,
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

  it("collapses whitespace in authored names", () => {
    expect(
      buildMetaTitle({ ...base, organization: { name: "Profit\n  Taker" } }),
    ).toBe("Frumentarius Build by Profit Taker")
  })
})

describe("buildMetaDescription", () => {
  const b = {
    name: "Frumentarius",
    description: null,
    item: { name: "Frumentarius" },
    guide: null,
  }

  it("falls back to a generic line, with no lead when name = item", () => {
    expect(buildMetaDescription(b)).toBe(
      "Frumentarius build with mods, arcanes, and stats.",
    )
  })

  it("leads with a custom name and prefers the guide summary", () => {
    expect(
      buildMetaDescription({
        ...b,
        name: "Eidolon\nsniper",
        description: "desc",
        guide: { summary: "Guide  text" },
      }),
    ).toBe("Eidolon sniper. Guide text")
  })
})

describe("resolveBuildImage", () => {
  const build = { item: { uniqueName: "/Lotus/Frume", imageName: "old.png" } }

  it("prefers the catalog's current image for the item", () => {
    expect(resolveBuildImage(build, { "/Lotus/Frume": "new.png" })).toBe(
      "new.png",
    )
  })

  it("falls back to the stored image on a map miss or no map", () => {
    expect(resolveBuildImage(build, {})).toBe("old.png")
    expect(resolveBuildImage(build, null)).toBe("old.png")
  })
})
