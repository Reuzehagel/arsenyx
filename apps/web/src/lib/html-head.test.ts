import { describe, expect, it } from "vitest"

import { dataPreloadScript } from "./html-head"

/** Runs the inline script against a fake pathname; returns the preloaded hrefs. */
function preloadsFor(pathname: string): string[] {
  const hrefs: string[] = []
  const document = {
    createElement: () => ({}) as { href?: string },
    head: { appendChild: (l: { href: string }) => hrefs.push(l.href) },
  }
  const script = dataPreloadScript({
    "/": ["home.json"],
    "/create": ["mods.json", "arcanes.json"],
    "/builds/*": ["image-map.json"],
  })
  new Function("location", "document", script)({ pathname }, document)
  return hrefs
}

describe("dataPreloadScript", () => {
  it("preloads an exact path's files", () => {
    expect(preloadsFor("/")).toEqual(["home.json"])
    expect(preloadsFor("/create")).toEqual(["mods.json", "arcanes.json"])
  })

  it("matches a /* prefix only with a segment after it", () => {
    expect(preloadsFor("/builds/abc123")).toEqual(["image-map.json"])
    expect(preloadsFor("/builds/")).toEqual([])
    expect(preloadsFor("/builds")).toEqual([])
  })

  it("preloads nothing elsewhere", () => {
    expect(preloadsFor("/create/x")).toEqual([])
    expect(preloadsFor("/browse")).toEqual([])
  })
})
