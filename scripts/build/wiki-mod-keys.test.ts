import { describe, expect, test } from "bun:test"

import { resolveWikiModKeys } from "./wiki-mod-keys"

describe("resolveWikiModKeys", () => {
  test("exact InternalName wins over a Name match", () => {
    const keys = resolveWikiModKeys(
      [{ uniqueName: "/A", name: "Alpha" }],
      [
        { internalName: "/A", name: "Other" },
        { internalName: "/B", name: "Alpha" },
      ],
    )
    expect(keys.get("/A")).toBe("/A")
  })

  test("falls back to a unique display Name on InternalName drift", () => {
    const keys = resolveWikiModKeys(
      [{ uniqueName: "/IceShieldAugmentTwoCard", name: "Cold Front" }],
      [{ internalName: "/IceShieldAugment2Card", name: "Cold Front" }],
    )
    expect(keys.get("/IceShieldAugmentTwoCard")).toBe("/IceShieldAugment2Card")
  })

  test("no fallback when the Name repeats among DE mods", () => {
    const keys = resolveWikiModKeys(
      [
        { uniqueName: "/X1", name: "Dup" },
        { uniqueName: "/X2", name: "Dup" },
      ],
      [{ internalName: "/W", name: "Dup" }],
    )
    expect(keys.size).toBe(0)
  })

  test("no fallback when the Name repeats among wiki records", () => {
    const keys = resolveWikiModKeys(
      [{ uniqueName: "/X", name: "Dup" }],
      [
        { internalName: "/W1", name: "Dup" },
        { internalName: "/W2", name: "Dup" },
      ],
    )
    expect(keys.has("/X")).toBe(false)
  })

  test("unmatched mods are absent", () => {
    const keys = resolveWikiModKeys(
      [{ uniqueName: "/X", name: "Nope" }, { name: "No uniqueName" }],
      [{ internalName: "/W", name: "Other" }],
    )
    expect(keys.size).toBe(0)
  })
})
