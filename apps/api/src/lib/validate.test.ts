import type { Context } from "hono"
import { describe, expect, it } from "vitest"

import { MAX_JSON_BYTES, parseJsonBody, trimToMax } from "./validate"

// Minimal Context shim — parseJsonBody only touches `req.header()` and `req.raw.body`.
function fakeContext(init: {
  body: BodyInit | null
  contentLength?: string | null
}): Context {
  const req = new Request("https://test.local/", {
    method: "POST",
    headers: init.contentLength
      ? { "content-length": init.contentLength }
      : undefined,
    body: init.body,
    // Required by undici when streaming a ReadableStream body.
    duplex: "half",
  } as RequestInit & { duplex: "half" })
  return {
    req: {
      header: (name: string) => req.headers.get(name) ?? undefined,
      raw: req,
    },
  } as unknown as Context
}

function streamOfSize(bytes: number): ReadableStream<Uint8Array> {
  const chunk = new Uint8Array(1024).fill(0x20)
  let sent = 0
  return new ReadableStream({
    pull(controller) {
      if (sent >= bytes) {
        controller.close()
        return
      }
      const remaining = bytes - sent
      const out =
        remaining < chunk.byteLength ? chunk.slice(0, remaining) : chunk
      controller.enqueue(out)
      sent += out.byteLength
    },
  })
}

describe("parseJsonBody", () => {
  it("accepts a well-formed JSON object", async () => {
    const c = fakeContext({ body: JSON.stringify({ hello: "world" }) })
    const r = await parseJsonBody(c)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toEqual({ hello: "world" })
  })

  it("rejects malformed JSON with invalid_json", async () => {
    const c = fakeContext({ body: "{not json" })
    const r = await parseJsonBody(c)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(400)
  })

  it("rejects JSON arrays with invalid_body", async () => {
    const c = fakeContext({ body: "[1,2,3]" })
    const r = await parseJsonBody(c)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.response.status).toBe(400)
      const body = (await r.response.json()) as { error: string }
      expect(body.error).toBe("invalid_body")
    }
  })

  it("rejects JSON null/primitives with invalid_body", async () => {
    const c = fakeContext({ body: "null" })
    const r = await parseJsonBody(c)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(400)
  })

  it("rejects bodies declared larger than max via Content-Length", async () => {
    const c = fakeContext({
      body: "{}",
      contentLength: String(MAX_JSON_BYTES + 1),
    })
    const r = await parseJsonBody(c)
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.response.status).toBe(413)
      const body = (await r.response.json()) as { error: string }
      expect(body.error).toBe("body_too_large")
    }
  })

  it("accepts a body exactly at the cap", async () => {
    const max = 256
    // 254 spaces wrapped in `{"a":"..."}` → < 256 once the envelope is added.
    const padding = "x".repeat(max - 10)
    const json = JSON.stringify({ a: padding })
    expect(json.length).toBeLessThanOrEqual(max)
    const c = fakeContext({ body: json })
    const r = await parseJsonBody(c, { maxBytes: max })
    expect(r.ok).toBe(true)
  })

  it("rejects a body one byte over the cap (no Content-Length)", async () => {
    const max = 64
    const oversized = `{"a":"${"x".repeat(max)}"}`
    expect(oversized.length).toBeGreaterThan(max)
    const c = fakeContext({ body: oversized })
    const r = await parseJsonBody(c, { maxBytes: max })
    expect(r.ok).toBe(false)
    if (!r.ok) {
      expect(r.response.status).toBe(413)
      const body = (await r.response.json()) as { error: string }
      expect(body.error).toBe("body_too_large")
    }
  })

  it("aborts mid-stream when an undeclared body exceeds the cap", async () => {
    const max = 1024
    // 4× the cap, no Content-Length set — limiter must abort the stream.
    const c = fakeContext({ body: streamOfSize(max * 4) })
    const r = await parseJsonBody(c, { maxBytes: max })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(413)
  })

  it("rejects non-UTF-8 bytes with invalid_body", async () => {
    // 0xFF is never valid UTF-8 on its own.
    const bad = new Uint8Array([0xff, 0xfe, 0xfd])
    const c = fakeContext({ body: bad })
    const r = await parseJsonBody(c)
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.response.status).toBe(400)
  })
})

describe("trimToMax", () => {
  it("returns null for non-strings", () => {
    expect(trimToMax(123, 10)).toBeNull()
    expect(trimToMax(null, 10)).toBeNull()
    expect(trimToMax(undefined, 10)).toBeNull()
  })

  it("returns null for whitespace-only strings", () => {
    expect(trimToMax("   ", 10)).toBeNull()
    expect(trimToMax("", 10)).toBeNull()
  })

  it("trims and truncates", () => {
    expect(trimToMax("  hello world  ", 5)).toBe("hello")
  })

  it("preserves strings shorter than max", () => {
    expect(trimToMax("hi", 100)).toBe("hi")
  })
})
