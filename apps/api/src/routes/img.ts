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
// - Content-Type gate — see below.
// - Subrequest pinned to https + redirects manual so a clever 3xx chain can't
//   reach a private host that the initial URL avoided.
//
// The Content-Type gate is the load-bearing one, because this origin holds the
// session cookies (auth.ts pins them host-only here). Anything that renders as
// a DOCUMENT rather than an image runs script on api.arsenyx.com; originGuard
// blocks same-origin mutations, but reads — /auth/get-session,
// /me/builds/export, /admin/users — would all be exfiltratable. SVG is the
// obvious case (inert inside an <img>, scriptable when navigated to), and
// `nosniff` is no help since the type would be honestly declared.
//
// Three layers, in order: normalise the upstream type, reject the scriptable
// ones, and echo back only the normalised value — never the raw header, which
// can carry a second type (`image/png, text/html`) that the gate reads as one
// thing and the browser resolves as another. The response also carries
// `default-src 'none'; sandbox` so a future hole isn't immediately scriptable.

// 3 MB covers avatars and guide screenshots while limiting the proxy's value
// as a bandwidth amplifier; anything larger is almost certainly abuse.
const MAX_BYTES = 3 * 1024 * 1024
const TIMEOUT_MS = 8000

const SCRIPTABLE_IMAGE_TYPES = new Set(["image/svg+xml"])

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
      blockPrivateDns: true,
    })
  } catch (err) {
    if (err instanceof SafeFetchError) {
      if (err.code === "invalid_redirect")
        return c.json({ error: "bad_redirect" }, 502)
      if (err.code === "private_host") return c.json({ error: "bad_host" }, 502)
      if (err.code === "too_large") return c.json({ error: "too_large" }, 413)
      if (err.code === "upstream_status")
        return c.json({ error: "upstream_status", status: err.status }, 502)
    }
    return c.json({ error: "upstream_failed" }, 502)
  }

  // Strip parameters (`; charset=utf-8`) before comparing, or a padded
  // `image/svg+xml;charset=utf-8` walks past the check. Only `mediaType` is
  // used from here on — see the header comment on why the raw value never
  // reaches the response.
  const mediaType = (upstream.headers.get("content-type") ?? "")
    .toLowerCase()
    .split(";")[0]
    .trim()
  if (
    !mediaType.startsWith("image/") ||
    SCRIPTABLE_IMAGE_TYPES.has(mediaType)
  ) {
    return c.json({ error: "not_image" }, 415)
  }
  // A comma-joined header (`image/png, text/html`) survives the check above as
  // one opaque token but resolves to its LAST type in the browser, so reject
  // anything that isn't a single well-formed type rather than echoing it.
  if (!/^image\/[a-z0-9][a-z0-9!#$&^_.+-]*$/.test(mediaType)) {
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
      "Content-Type": mediaType,
      // 1 day at the edge + browser — avatars/org images change rarely; users
      // who change theirs see a new URL (?v= bust from GitHub, new upload key
      // from anywhere we host org images).
      "Cache-Control": "public, max-age=86400, immutable",
      "X-Content-Type-Options": "nosniff",
      "Cross-Origin-Resource-Policy": "cross-origin",
      // If a scriptable type ever reaches here anyway, `sandbox` (no
      // allow-scripts) renders it in an opaque origin with scripting off.
      "Content-Security-Policy": "default-src 'none'; sandbox",
    },
  })
})
