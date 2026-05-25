import { Hono } from "hono"

import { SafeFetchError, safeFetch } from "../lib/safe-fetch"
import { validateExternalUrl } from "../lib/validate"

// Server-side image proxy. The browser hits api.arsenyx.com/img instead of
// the original third-party URL, so an org/profile admin can't use a malicious
// `image` URL to harvest visitor IPs / Referer. Cloudflare Image Resizing
// would do this for us but the free plan only supports it for images stored
// in Cloudflare Images, not arbitrary external URLs.
//
// Hardening:
// - validateExternalUrl gates the source (https-only, no private hosts).
// - Cap on response size and request timeout — prevents abuse as a tarpit
//   proxy that ties up Worker subrequests on huge / slow upstreams.
// - Strict Content-Type check — refuses anything that isn't `image/*` so the
//   endpoint can't be used to launder text/html through our origin.
// - Subrequest pinned to https + redirects manual so a clever 3xx chain can't
//   reach a private host that the initial URL avoided.

const MAX_BYTES = 5 * 1024 * 1024
const TIMEOUT_MS = 8000

export const img = new Hono()

img.get("/", async (c) => {
  const url = c.req.query("u")
  const validated = url ? validateExternalUrl(url) : null
  if (!validated) return c.json({ error: "invalid_url" }, 400)

  let upstream: Response
  try {
    upstream = await safeFetch(validated, {
      isAllowed: (u) => validateExternalUrl(u.href) !== null,
      maxBytes: MAX_BYTES,
      timeoutMs: TIMEOUT_MS,
      maxRedirects: 3,
      headers: { accept: "image/*" },
      cf: { cacheTtl: 86400, cacheEverything: true },
    })
  } catch (err) {
    if (err instanceof SafeFetchError) {
      if (err.code === "invalid_redirect")
        return c.json({ error: "bad_redirect" }, 502)
      if (err.code === "too_large") return c.json({ error: "too_large" }, 413)
      if (err.code === "upstream_status")
        return c.json({ error: "upstream_status", status: err.status }, 502)
    }
    return c.json({ error: "upstream_failed" }, 502)
  }

  const contentType = upstream.headers.get("content-type") ?? ""
  if (!contentType.toLowerCase().startsWith("image/")) {
    return c.json({ error: "not_image" }, 415)
  }

  const reader = upstream.body?.getReader()
  if (!reader) return c.json({ error: "empty_body" }, 502)

  const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>()
  const writer = writable.getWriter()
  void (async () => {
    let total = 0
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (!value) continue
        total += value.byteLength
        if (total > MAX_BYTES) {
          await writer.abort(new Error("too_large"))
          void reader.cancel()
          return
        }
        await writer.write(value)
      }
      await writer.close()
    } catch {
      try {
        await writer.abort()
      } catch {
        // already closed
      }
    }
  })()

  return new Response(readable, {
    headers: {
      "Content-Type": contentType,
      // 1 day at the edge + browser — avatars/org images change rarely; users
      // who change theirs see a new URL (?v= bust from GitHub, new upload key
      // from anywhere we host org images).
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "cross-origin",
    },
  })
})
