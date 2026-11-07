import { describe, expect, it } from "vitest"

import { initialOf } from "./user-avatar"

describe("initialOf", () => {
  it.each([
    ["dana", "D"],
    ["  Sam Lee ", "S"],
    ["🦊 Fox Den", "F"],
    ["👩🏽‍💻 Priya", "P"],
    ["Ólafur", "Ó"],
    ["王秀英", "王"],
    ["نور", "ن"],
    ["🦊", "🦊"],
    ["", "?"],
  ])("%j → %j", (name, initial) => {
    expect(initialOf(name)).toBe(initial)
  })
})
