import { describe, expect, it } from "bun:test"

import { preserveOverframeLineBreaks } from "../markdown"

describe("preserveOverframeLineBreaks", () => {
  it("converts single newlines to markdown hard breaks", () => {
    expect(preserveOverframeLineBreaks("EVO II: text\nEVO III: text")).toBe(
      "EVO II: text  \nEVO III: text",
    )
  })

  it("preserves paragraph breaks", () => {
    expect(preserveOverframeLineBreaks("First line\n\nSecond line")).toBe(
      "First line\n\nSecond line",
    )
  })

  it("normalizes windows newlines", () => {
    expect(preserveOverframeLineBreaks("First\r\nSecond")).toBe(
      "First  \nSecond",
    )
  })

  it("isolates standalone youtube links as paragraphs", () => {
    expect(
      preserveOverframeLineBreaks(
        "Example Run:\n[Sicarus Run](https://www.youtube.com/watch?v=3K6YNWS8oI8)\nRiven Ranking List\nhttps://imgur.com/a/example",
      ),
    ).toBe(
      "Example Run:\n\n[Sicarus Run](https://www.youtube.com/watch?v=3K6YNWS8oI8)\n\nRiven Ranking List  \nhttps://imgur.com/a/example",
    )
  })
})
