import { describe, it, expect } from "bun:test"

import { ok, err, getErrorMessage } from "../result"

// =============================================================================
// ok() TESTS
// =============================================================================

describe("ok", () => {
  it("creates a void success result", () => {
    const result = ok()
    expect(result.success).toBe(true)
    expect(result).toEqual({ success: true, data: undefined })
  })

  it("creates a success result with data", () => {
    const result = ok("hello")
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe("hello")
    }
  })

  it("creates a success result with object data", () => {
    const data = { id: 1, name: "test" }
    const result = ok(data)
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toEqual({ id: 1, name: "test" })
    }
  })
})

// =============================================================================
// err() TESTS
// =============================================================================

describe("err", () => {
  it("creates an error result", () => {
    const result = err("something went wrong")
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("something went wrong")
    }
  })
})

// =============================================================================
// getErrorMessage() TESTS
// =============================================================================

describe("getErrorMessage", () => {
  it("extracts message from Error instance", () => {
    const error = new Error("test error")
    expect(getErrorMessage(error, "fallback")).toBe("test error")
  })

  it("returns fallback for string value", () => {
    expect(getErrorMessage("not an error", "fallback")).toBe("fallback")
  })

  it("returns fallback for null", () => {
    expect(getErrorMessage(null, "fallback")).toBe("fallback")
  })

  it("returns fallback for undefined", () => {
    expect(getErrorMessage(undefined, "fallback")).toBe("fallback")
  })

  it("returns fallback for number", () => {
    expect(getErrorMessage(42, "fallback")).toBe("fallback")
  })
})
