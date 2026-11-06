import { describe, expect, test } from "bun:test"

import { readWikiModFlags, resolveWikiModKeys } from "./wiki-mod-flags"

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

describe("readWikiModFlags", () => {
  const wiki = {
    DefaultUpgrades: {
      Drifted: {
        InternalName: "/Wiki/Drifted",
        Name: "Drifted",
        IsExilus: true,
        Tradable: false,
        Conclave: true,
      },
      PvpOnly: { InternalName: "/PvpOnly", Name: "PvP Only", Conclave: true },
      PveToo: { InternalName: "/PveToo", Name: "PvE Too", Conclave: true },
      Cut: { InternalName: "/Cut", Name: "Cut", _IgnoreEntry: true },
    },
  }
  const de = [
    { uniqueName: "/De/Drifted", name: "Drifted" },
    { uniqueName: "/PvpOnly", name: "PvP Only" },
    { uniqueName: "/PveToo", name: "PvE Too" },
    { uniqueName: "/Cut", name: "Cut" },
  ]
  const flags = readWikiModFlags(wiki, de, new Set(["/PveToo", "/Stale"]))

  test("keys every flag by the DE uniqueName, through a Name fallback too", () => {
    expect(flags.exilus.get("/De/Drifted")).toBe(true)
    expect(flags.tradable.get("/De/Drifted")).toBe(false)
    expect([...flags.conclave].sort()).toEqual(["/De/Drifted", "/PvpOnly"])
    expect([...flags.ignore]).toEqual(["/Cut"])
    expect(flags.nameFallbacks).toEqual(["Drifted"])
  })

  test("the PvE-usable allowlist un-flags Conclave and reports stale entries", () => {
    expect(flags.conclave.has("/PveToo")).toBe(false)
    expect(flags.unmatchedPveUsable).toEqual(["/Stale"])
  })
})
