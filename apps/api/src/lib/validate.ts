import type { Context } from "hono"

// Hard cap on any JSON request body. Largest legitimate payload today is a
// build PATCH with a ~50KB guide description plus buildData; 512KB leaves
// generous headroom while blocking storage-fill / DoS via oversized JSON.
export const MAX_JSON_BYTES = 512 * 1024

type JsonBodyResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; response: Response }

function jsonError(code: string, status: 400 | 413): Response {
  return new Response(JSON.stringify({ error: code }), {
    status,
    headers: { "Content-Type": "application/json" },
  })
}

// Streams the body and aborts the moment the byte counter exceeds `max`.
// `c.req.text()` would buffer the full body first — a chunked transfer with no
// Content-Length header could allocate up to the Workers per-request limit
// (~100MB) before any size check ran.
export async function parseJsonBody(
  c: Context,
  opts: { maxBytes?: number } = {},
): Promise<JsonBodyResult> {
  const max = opts.maxBytes ?? MAX_JSON_BYTES

  const declared = c.req.header("content-length")
  if (declared) {
    const n = parseInt(declared, 10)
    if (Number.isFinite(n) && n > max) {
      return { ok: false, response: jsonError("body_too_large", 413) }
    }
  }

  const stream = c.req.raw.body
  if (!stream) {
    return { ok: false, response: jsonError("invalid_body", 400) }
  }

  const reader = stream.getReader()
  const chunks: Uint8Array[] = []
  let total = 0
  let raw: string
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      if (!value) continue
      total += value.byteLength
      if (total > max) {
        void reader.cancel()
        return { ok: false, response: jsonError("body_too_large", 413) }
      }
      chunks.push(value)
    }
    const merged = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.byteLength
    }
    raw = new TextDecoder("utf-8", { fatal: true }).decode(merged)
  } catch {
    return { ok: false, response: jsonError("invalid_body", 400) }
  } finally {
    reader.releaseLock()
  }

  let body: unknown
  try {
    body = JSON.parse(raw)
  } catch {
    return { ok: false, response: jsonError("invalid_json", 400) }
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, response: jsonError("invalid_body", 400) }
  }

  return { ok: true, value: body as Record<string, unknown> }
}

export function trimToMax(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null
  const t = v.trim()
  return t.length > 0 ? t.slice(0, max) : null
}

// Strict validator for user-supplied external image URLs. Rejects anything
// that's not a parseable absolute https:// URL with a non-local hostname.
//
// Without this, a malicious org/profile admin could set `image` to a server
// they control and silently log every visitor's IP and Referer header when
// the browser loads the avatar. The web client compounds this defence by
// rendering through Cloudflare Image Resizing so the source fetch happens
// from CF's network, not the visitor's browser.
// mDNS / informal private TLDs — anchored at hostname end so legitimate
// public hostnames that contain `.local` as a middle label (e.g.
// `cdn.local-cdn.example.com`) are NOT rejected.
const PRIVATE_TLD_RE = /\.(local|internal)$/i
// `localhost` as the entire hostname — anchoring at end avoids false-positive
// rejection of `localhost.example.com` and similar registrable subdomains.
const LOCALHOST_RE = /^localhost$/i
// IPv4 in dotted-quad form whose first octet falls in private/loopback/
// link-local space. The trailing `\.\d` requirement rules out hostnames like
// `127.example.com` (which the URL parser accepts as a regular DNS name) so
// only real IPv4 literals are rejected.
const PRIVATE_IP_RE =
  /^(0|10|127|192\.168|169\.254|172\.(1[6-9]|2\d|3[01]))\.\d/
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
  if (LOCALHOST_RE.test(parsed.hostname)) return null
  if (PRIVATE_TLD_RE.test(parsed.hostname)) return null
  if (PRIVATE_IP_RE.test(parsed.hostname)) return null
  if (NUMERIC_HOST_RE.test(parsed.hostname)) return null
  // Bare IPv6 literals and userinfo (`user:pw@host`) aren't accepted — too
  // easy to use as a vector and no legitimate image host uses them.
  if (parsed.hostname.startsWith("[")) return null
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
