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
  const decoder = new TextDecoder("utf-8", { fatal: true })
  let raw = ""
  let total = 0
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
      raw += decoder.decode(value, { stream: true })
    }
    raw += decoder.decode()
  } catch {
    return { ok: false, response: jsonError("invalid_body", 400) }
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

export function hasPrismaCode(err: unknown, code: string): boolean {
  return (
    typeof err === "object" &&
    err != null &&
    (err as { code?: string }).code === code
  )
}
