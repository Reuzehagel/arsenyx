import { describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))

const { parseBearerToken } = await import("../api-keys")

describe("parseBearerToken", () => {
  it("accepts bearer auth schemes case-insensitively", () => {
    expect(parseBearerToken("bearer raw-token")).toBe("raw-token")
    expect(parseBearerToken("Bearer raw-token")).toBe("raw-token")
    expect(parseBearerToken("BEARER raw-token")).toBe("raw-token")
  })

  it("rejects missing or non-bearer auth headers", () => {
    expect(parseBearerToken(null)).toBeNull()
    expect(parseBearerToken("Basic raw-token")).toBeNull()
    expect(parseBearerToken("Bearer")).toBeNull()
  })
})
