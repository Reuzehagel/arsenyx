// SSRF-hardened fetch for the image proxy (routes/img.ts): a wall-clock
// timeout, a DoH check that each hop's hostname doesn't resolve to a private
// address, manual redirect handling that re-validates every hop's target
// against an allowlist (so a 3xx chain can't escape to a private host the
// initial URL avoided), and a declared Content-Length pre-check. The body is
// returned intact — the caller enforces its own hard byte cap while reading.

import { isPrivateIp } from "./validate"

export type SafeFetchErrorCode =
  | "fetch_failed"
  | "invalid_redirect"
  | "private_host"
  | "too_many_redirects"
  | "upstream_status"
  | "too_large"

export class SafeFetchError extends Error {
  constructor(
    public code: SafeFetchErrorCode,
    public status?: number,
  ) {
    super(code)
    this.name = "SafeFetchError"
  }
}

export interface SafeFetchOptions {
  /** Gate for every redirect target. The initial URL is the caller's to
   *  validate before calling. */
  isAllowed: (url: URL) => boolean
  /** Reject up front if the upstream declares a Content-Length over this. */
  maxBytes?: number
  timeoutMs: number
  /** Max redirects to follow (each re-validated). Default 0 = none. */
  maxRedirects?: number
  headers?: Record<string, string>
  /** Cloudflare-specific request init (cacheTtl, cacheEverything). */
  cf?: Record<string, unknown>
}

interface DohAnswer {
  type?: number
  data?: unknown
}

interface DohResponse {
  Answer?: DohAnswer[]
}

/**
 * Resolve `hostname` via Cloudflare DNS-over-HTTPS (A + AAAA) and return true
 * if ANY resolved address is private.
 *
 * FAIL OPEN: if the DoH request throws, is non-ok, or the JSON can't be
 * parsed, we treat the host as not-private so a resolver hiccup doesn't break
 * legitimate images. The real attack — attacker DNS returning a private IP —
 * is still caught, because 1.1.1.1 will faithfully return that record.
 */
async function hostnameResolvesToPrivate(
  hostname: string,
  timeoutMs: number,
): Promise<boolean> {
  const query = async (type: "A" | "AAAA"): Promise<boolean> => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      const res = await fetch(
        `https://1.1.1.1/dns-query?name=${encodeURIComponent(hostname)}&type=${type}`,
        {
          headers: { accept: "application/dns-json" },
          signal: ctrl.signal,
        },
      )
      if (!res.ok) return false // fail open
      const json = (await res.json()) as DohResponse
      const answers = Array.isArray(json.Answer) ? json.Answer : []
      for (const answer of answers) {
        // type 1 = A, type 28 = AAAA
        if (
          (answer.type === 1 || answer.type === 28) &&
          typeof answer.data === "string"
        ) {
          if (isPrivateIp(answer.data.trim())) return true
        }
      }
      return false
    } catch {
      return false // fail open
    } finally {
      clearTimeout(timer)
    }
  }

  const [aPrivate, aaaaPrivate] = await Promise.all([query("A"), query("AAAA")])
  return aPrivate || aaaaPrivate
}

export async function safeFetch(
  url: string,
  opts: SafeFetchOptions,
): Promise<Response> {
  const { isAllowed, maxBytes, timeoutMs, maxRedirects = 0, headers, cf } = opts

  const fetchOnce = async (target: string): Promise<Response> => {
    const ctrl = new AbortController()
    const timer = setTimeout(() => ctrl.abort(), timeoutMs)
    try {
      return await fetch(target, {
        signal: ctrl.signal,
        // Manual so every Location is re-validated below — `redirect: "follow"`
        // would let the upstream reach an arbitrary host on our behalf.
        redirect: "manual",
        ...(headers ? { headers } : {}),
        ...(cf ? { cf } : {}),
      } as RequestInit)
    } catch {
      throw new SafeFetchError("fetch_failed")
    } finally {
      clearTimeout(timer)
    }
  }

  let current = url

  // Checked before every fetch. DoH can't screen an IP-literal host — that's
  // the caller's validation and isAllowed's job; this catches DNS names whose
  // A/AAAA records point inside.
  const assertPublicHost = async (target: string) => {
    if (await hostnameResolvesToPrivate(new URL(target).hostname, timeoutMs)) {
      throw new SafeFetchError("private_host")
    }
  }

  await assertPublicHost(current)

  let res = await fetchOnce(current)

  let hops = 0
  while (res.status >= 300 && res.status < 400) {
    if (hops >= maxRedirects) throw new SafeFetchError("too_many_redirects")
    const loc = res.headers.get("location")
    let next: string
    try {
      next = new URL(loc ?? "", current).toString()
    } catch {
      throw new SafeFetchError("invalid_redirect")
    }
    if (!isAllowed(new URL(next))) throw new SafeFetchError("invalid_redirect")
    await assertPublicHost(next)
    hops += 1
    current = next
    res = await fetchOnce(current)
  }

  if (!res.ok) throw new SafeFetchError("upstream_status", res.status)

  if (maxBytes !== undefined) {
    const declared = res.headers.get("content-length")
    if (declared) {
      const n = parseInt(declared, 10)
      if (Number.isFinite(n) && n > maxBytes) {
        throw new SafeFetchError("too_large")
      }
    }
  }

  return res
}
