import type { Context } from "hono"
import { HTTPException } from "hono/http-exception"
import type { ContentfulStatusCode } from "hono/utils/http-status"

// Hard cap on any JSON request body. Largest legitimate payload today is a
// build PATCH with a ~50KB guide description plus buildData; 512KB leaves
// generous headroom while blocking storage-fill / DoS via oversized JSON.
export const MAX_JSON_BYTES = 512 * 1024

/** A JSON `{ error: code }` response, thrown out of a handler. Hono's error
 *  handling (and app.onError) answers an HTTPException with its `res`. */
export function httpError(status: ContentfulStatusCode, code: string) {
  return new HTTPException(status, {
    res: Response.json({ error: code }, { status }),
  })
}

class BodyTooLargeError extends Error {}

/** Yields `body`'s chunks, cancelling the stream and throwing
 *  {@link BodyTooLargeError} the moment the running total passes `max` — so a
 *  chunked body with no Content-Length can't allocate past the cap. */
export async function* readCapped(
  body: ReadableStream<Uint8Array>,
  max: number,
): AsyncGenerator<Uint8Array> {
  const reader = body.getReader()
  let total = 0
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      if (!value) continue
      total += value.byteLength
      if (total > max) {
        void reader.cancel()
        throw new BodyTooLargeError()
      }
      yield value
    }
  } finally {
    reader.releaseLock()
  }
}

// Streams through readCapped rather than `c.req.text()`, which buffers the
// whole body first — up to the Workers per-request limit (~100MB) before any
// size check ran. Throws an httpError (400/413) for anything that isn't a
// JSON object within the cap.
export async function parseJsonBody(
  c: Context,
  opts: { maxBytes?: number } = {},
): Promise<Record<string, unknown>> {
  const max = opts.maxBytes ?? MAX_JSON_BYTES

  const declared = parseInt(c.req.header("content-length") ?? "", 10)
  if (Number.isFinite(declared) && declared > max) {
    throw httpError(413, "body_too_large")
  }

  const stream = c.req.raw.body
  if (!stream) throw httpError(400, "invalid_body")

  let raw = ""
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true })
    for await (const chunk of readCapped(stream, max)) {
      raw += decoder.decode(chunk, { stream: true })
    }
    raw += decoder.decode()
  } catch (err) {
    if (err instanceof BodyTooLargeError) throw httpError(413, "body_too_large")
    throw httpError(400, "invalid_body")
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    throw httpError(400, "invalid_json")
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw httpError(400, "invalid_body")
  }
  return body as Record<string, unknown>
}

export function trimToMax(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length > 0 ? t.slice(0, max) : null
}

/**
 * True if `ip` is in a private, loopback, link-local, CGNAT, or ULA range and
 * so must never be reachable from a server-side fetch.
 */
export function isPrivateIp(ip: string): boolean {
  const v4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (v4) {
    const a = Number(v4[1])
    const b = Number(v4[2])
    if (a === 0 || a === 10 || a === 127) return true
    if (a === 169 && b === 254) return true // link-local
    if (a === 192 && b === 168) return true
    if (a === 172 && b >= 16 && b <= 31) return true
    if (a === 100 && b >= 64 && b <= 127) return true // CGNAT 100.64.0.0/10
    return false
  }

  const v6 = ip.toLowerCase()
  if (v6 === "::1" || v6 === "::") return true
  if (v6.startsWith("fe80")) return true // link-local
  if (v6.startsWith("fc") || v6.startsWith("fd")) return true // ULA fc00::/7
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(v6)
  if (mapped) return isPrivateIp(mapped[1])

  return false
}

// Strict validator for user-supplied external image URLs. Rejects anything
// that's not a parseable absolute https:// URL with a non-local hostname.
//
// Without this, a malicious org/profile admin could set `image` to a server
// they control and silently log every visitor's IP and Referer header when
// the browser loads the avatar. The web client renders these through the
// /img proxy (routes/img.ts), so the source fetch happens from the Worker,
// not the visitor's browser.
// mDNS / informal private TLDs — anchored at hostname end so legitimate
// public hostnames that contain `.local` as a middle label (e.g.
// `cdn.local-cdn.example.com`) are NOT rejected.
const PRIVATE_TLD_RE = /\.(local|internal)$/i
// `localhost` as the entire hostname — anchoring at end avoids false-positive
// rejection of `localhost.example.com` and similar registrable subdomains.
const LOCALHOST_RE = /^localhost$/i
// A leading dotted quad: an IPv4 literal, or a wildcard-DNS name built on one
// (`10.0.0.1.nip.io`). `127.example.com` doesn't match.
const LEADING_QUAD_RE = /^\d{1,3}(\.\d{1,3}){3}(?=\.|$)/
// Anything that parses as a single integer or 0x… hex literal can resolve to
// an arbitrary IPv4 (e.g. `2130706433` → 127.0.0.1, `0x7f000001` → 127.0.0.1).
// Hostnames in legitimate image CDNs always contain at least one alphabetic
// character or are dotted-quads (caught above), so refusing these isn't an
// over-block.
const NUMERIC_HOST_RE = /^(0x[0-9a-f]+|[0-9]+)$/i
const MAX_URL_LEN = 500

export function validateExternalUrl(v: unknown): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  if (t.length === 0 || t.length > MAX_URL_LEN) return null

  let parsed: URL
  try {
    parsed = new URL(t)
  } catch {
    return null
  }

  if (parsed.protocol !== "https:") return null
  if (!parsed.hostname) return null
  // Lowercase and strip a single trailing dot (the absolute-FQDN form, e.g.
  // `localhost.`) before the guards — otherwise `https://localhost./` slips
  // past the anchored localhost/private-TLD checks.
  const host = parsed.hostname.toLowerCase().replace(/\.$/, "")
  if (LOCALHOST_RE.test(host)) return null
  if (PRIVATE_TLD_RE.test(host)) return null
  const quad = LEADING_QUAD_RE.exec(host)?.[0]
  if (quad && isPrivateIp(quad)) return null
  if (NUMERIC_HOST_RE.test(host)) return null
  // Bare IPv6 literals and userinfo (`user:pw@host`) aren't accepted — too
  // easy to use as a vector and no legitimate image host uses them.
  if (host.startsWith("[")) return null
  if (parsed.username || parsed.password) return null

  return parsed.toString()
}

export function hasPrismaCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err != null &&
    (err as { code?: string }).code === code
  )
}

/** Prisma's "record not found" (a delete/update whose `where` matched
 *  nothing). */
export function isPrismaNotFound(err: unknown): boolean {
  return hasPrismaCode(err, "P2025")
}
