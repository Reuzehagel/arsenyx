import { afterEach, describe, expect, it, vi } from "vitest"

import { isPrivateIp, SafeFetchError, safeFetch } from "./safe-fetch"

const realFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = realFetch
  vi.restoreAllMocks()
})

// Queue stub: each fetch() call returns the next queued Response.
function queueFetch(responses: Response[]) {
  let i = 0
  globalThis.fetch = vi.fn(async () => {
    const r = responses[i++]
    if (!r) throw new Error("no more queued responses")
    return r
  }) as unknown as typeof fetch
}

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { location } })
}

const allowGood = (u: URL) => u.hostname === "good.com"

describe("safeFetch", () => {
  it("returns the final response after an allowed same-host redirect", async () => {
    queueFetch([
      redirect("https://good.com/final"),
      new Response("ok", { status: 200 }),
    ])
    const res = await safeFetch("https://good.com/start", {
      isAllowed: allowGood,
      timeoutMs: 1000,
      maxRedirects: 3,
    })
    expect(res.status).toBe(200)
    expect(await res.text()).toBe("ok")
  })

  it("throws invalid_redirect when a hop points off-allowlist", async () => {
    queueFetch([redirect("https://evil.com/x")])
    await expect(
      safeFetch("https://good.com/start", {
        isAllowed: allowGood,
        timeoutMs: 1000,
        maxRedirects: 3,
      }),
    ).rejects.toMatchObject({ code: "invalid_redirect" } as SafeFetchError)
  })

  it("throws too_many_redirects past the cap", async () => {
    queueFetch([redirect("https://good.com/1"), redirect("https://good.com/2")])
    await expect(
      safeFetch("https://good.com/start", {
        isAllowed: allowGood,
        timeoutMs: 1000,
        maxRedirects: 1,
      }),
    ).rejects.toMatchObject({ code: "too_many_redirects" })
  })

  it("throws too_large when the declared Content-Length exceeds maxBytes", async () => {
    queueFetch([
      new Response("body", {
        status: 200,
        headers: { "content-length": "999999" },
      }),
    ])
    await expect(
      safeFetch("https://good.com/big", {
        isAllowed: allowGood,
        timeoutMs: 1000,
        maxBytes: 1024,
      }),
    ).rejects.toMatchObject({ code: "too_large" })
  })

  it("throws upstream_status on a non-ok response", async () => {
    queueFetch([new Response("nope", { status: 404 })])
    await expect(
      safeFetch("https://good.com/missing", {
        isAllowed: allowGood,
        timeoutMs: 1000,
      }),
    ).rejects.toMatchObject({ code: "upstream_status", status: 404 })
  })

  it("aborts and throws fetch_failed when the request exceeds the timeout", async () => {
    globalThis.fetch = vi.fn(
      (_input, init?: RequestInit) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          )
        }),
    ) as unknown as typeof fetch
    await expect(
      safeFetch("https://good.com/slow", {
        isAllowed: allowGood,
        timeoutMs: 10,
      }),
    ).rejects.toMatchObject({ code: "fetch_failed" })
  })
})

describe("isPrivateIp", () => {
  it("returns true for private, loopback, link-local, CGNAT, and ULA addresses", () => {
    const privateIps = [
      "10.0.0.1",
      "127.0.0.1",
      "169.254.169.254",
      "192.168.1.1",
      "172.16.0.1",
      "172.31.255.255",
      "100.64.0.1",
      "0.0.0.0",
      "::1",
      "fe80::1",
      "fd00::1",
      "fc00::1",
      "::ffff:127.0.0.1",
    ]
    for (const ip of privateIps) {
      expect(isPrivateIp(ip)).toBe(true)
    }
  })

  it("returns false for public addresses", () => {
    const publicIps = [
      "8.8.8.8",
      "1.1.1.1",
      "140.82.121.4",
      "172.15.0.1",
      "172.32.0.1",
      "100.63.0.1",
      "100.128.0.1",
      "2606:4700:4700::1111",
    ]
    for (const ip of publicIps) {
      expect(isPrivateIp(ip)).toBe(false)
    }
  })
})
