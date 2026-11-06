import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import { describe, expect, it } from "vitest"

import {
  MAX_JSON_BYTES,
  parseJsonBody,
  trimToMax,
  validateExternalUrl,
} from "./validate"

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

/** The JSON error a rejected parseJsonBody carries. */
async function rejection(p: Promise<unknown>) {
  const err = await p.then(
    () => {
      throw new Error("expected a rejection")
    },
    (e: unknown) => e,
  )
  expect(err).toBeInstanceOf(HTTPException)
  const res = (err as HTTPException).getResponse()
  const body = (await res.json()) as { error: string }
  return { status: res.status, error: body.error }
}

describe("parseJsonBody", () => {
  it("accepts a well-formed JSON object", async () => {
    const c = fakeContext({ body: JSON.stringify({ hello: "world" }) })
    expect(await parseJsonBody(c)).toEqual({ hello: "world" })
  })

  it("decodes multi-byte UTF-8 split across chunks", async () => {
    const bytes = new TextEncoder().encode(JSON.stringify({ n: "Ætherial ✓" }))
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        // Split inside the 3-byte check mark.
        controller.enqueue(bytes.slice(0, bytes.length - 3))
        controller.enqueue(bytes.slice(bytes.length - 3))
        controller.close()
      },
    })
    expect(await parseJsonBody(fakeContext({ body }))).toEqual({
      n: "Ætherial ✓",
    })
  })

  it("rejects malformed JSON with invalid_json", async () => {
    const c = fakeContext({ body: "{not json" })
    expect(await rejection(parseJsonBody(c))).toEqual({
      status: 400,
      error: "invalid_json",
    })
  })

  it("rejects JSON arrays and primitives with invalid_body", async () => {
    for (const body of ["[1,2,3]", "null", "3"]) {
      expect(await rejection(parseJsonBody(fakeContext({ body })))).toEqual({
        status: 400,
        error: "invalid_body",
      })
    }
  })

  it("rejects bodies declared larger than max via Content-Length", async () => {
    const c = fakeContext({
      body: "{}",
      contentLength: String(MAX_JSON_BYTES + 1),
    })
    expect(await rejection(parseJsonBody(c))).toEqual({
      status: 413,
      error: "body_too_large",
    })
  })

  it("accepts a body exactly at the cap", async () => {
    const max = 256
    const json = JSON.stringify({ a: "x".repeat(max - 8) })
    expect(json.length).toBe(max)
    const c = fakeContext({ body: json })
    expect(await parseJsonBody(c, { maxBytes: max })).toEqual(JSON.parse(json))
  })

  it("rejects a body one byte over the cap (no Content-Length)", async () => {
    const max = 64
    const oversized = `{"a":"${"x".repeat(max - 7)}"}`
    expect(oversized.length).toBe(max + 1)
    const c = fakeContext({ body: oversized })
    expect(await rejection(parseJsonBody(c, { maxBytes: max }))).toEqual({
      status: 413,
      error: "body_too_large",
    })
  })

  it("aborts mid-stream when an undeclared body exceeds the cap", async () => {
    const max = 1024
    // 4× the cap, no Content-Length set — limiter must abort the stream.
    const c = fakeContext({ body: streamOfSize(max * 4) })
    expect((await rejection(parseJsonBody(c, { maxBytes: max }))).status).toBe(
      413,
    )
  })

  it("rejects non-UTF-8 bytes with invalid_body", async () => {
    // 0xFF is never valid UTF-8 on its own.
    const c = fakeContext({ body: new Uint8Array([0xff, 0xfe, 0xfd]) })
    expect(await rejection(parseJsonBody(c))).toEqual({
      status: 400,
      error: "invalid_body",
    })
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

describe("validateExternalUrl", () => {
  it("accepts a normal https image URL", () => {
    expect(validateExternalUrl("https://cdn.example.com/a.png")).toBe(
      "https://cdn.example.com/a.png",
    )
  })

  it("rejects non-https and non-strings", () => {
    expect(validateExternalUrl("http://example.com/a.png")).toBeNull()
    expect(validateExternalUrl("ftp://example.com/a.png")).toBeNull()
    expect(validateExternalUrl(123)).toBeNull()
    expect(validateExternalUrl("not a url")).toBeNull()
  })

  it("rejects the CGNAT range 100.64.0.0/10 but allows its neighbours", () => {
    expect(validateExternalUrl("https://100.64.0.1/x.png")).toBeNull()
    expect(validateExternalUrl("https://100.127.255.255/x.png")).toBeNull()
    // Just outside the /10 on either side → public, allowed.
    expect(validateExternalUrl("https://100.63.0.1/x.png")).toBe(
      "https://100.63.0.1/x.png",
    )
    expect(validateExternalUrl("https://100.128.0.1/x.png")).toBe(
      "https://100.128.0.1/x.png",
    )
  })

  it("rejects RFC1918 / loopback / link-local literals", () => {
    expect(validateExternalUrl("https://127.0.0.1/x.png")).toBeNull()
    expect(validateExternalUrl("https://10.0.0.1/x.png")).toBeNull()
    expect(validateExternalUrl("https://192.168.1.1/x.png")).toBeNull()
    expect(validateExternalUrl("https://169.254.1.1/x.png")).toBeNull()
    expect(validateExternalUrl("https://172.16.0.1/x.png")).toBeNull()
  })

  it("rejects localhost and private TLDs including the trailing-dot form", () => {
    expect(validateExternalUrl("https://localhost/x.png")).toBeNull()
    expect(validateExternalUrl("https://LOCALHOST/x.png")).toBeNull()
    expect(validateExternalUrl("https://localhost./x.png")).toBeNull()
    expect(validateExternalUrl("https://api.internal/x.png")).toBeNull()
    expect(validateExternalUrl("https://api.internal./x.png")).toBeNull()
    expect(validateExternalUrl("https://box.local/x.png")).toBeNull()
  })

  it("rejects numeric / userinfo / IPv6 hosts", () => {
    expect(validateExternalUrl("https://2130706433/x.png")).toBeNull()
    expect(validateExternalUrl("https://0x7f000001/x.png")).toBeNull()
    expect(validateExternalUrl("https://user:pw@example.com/x.png")).toBeNull()
    expect(validateExternalUrl("https://[::1]/x.png")).toBeNull()
  })

  it("does not over-block public hosts containing private-ish labels", () => {
    expect(validateExternalUrl("https://cdn.local-cdn.example.com/x.png")).toBe(
      "https://cdn.local-cdn.example.com/x.png",
    )
    expect(validateExternalUrl("https://localhost.example.com/x.png")).toBe(
      "https://localhost.example.com/x.png",
    )
  })
})
