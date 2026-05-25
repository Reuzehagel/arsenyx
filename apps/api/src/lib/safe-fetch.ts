// SSRF-hardened fetch shared by the image proxy and the Overframe scraper.
// Both need the same defence: a wall-clock timeout, manual redirect handling
// that re-validates every hop's target against an allowlist (so a 3xx chain
// can't escape to a private host the initial URL avoided), and a declared
// Content-Length pre-check. The body is returned intact — each caller applies
// its own streaming vs. buffering strategy and its own hard byte cap while
// reading it.

export type SafeFetchErrorCode =
  | "fetch_failed"
  | "invalid_redirect"
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
  /** Gate for the initial URL and every redirect target. */
  isAllowed: (url: URL) => boolean
  /** Reject up front if the upstream declares a Content-Length over this. */
  maxBytes?: number
  timeoutMs: number
  /** Max redirects to follow (each re-validated). Default 0 = none. */
  maxRedirects?: number
  headers?: Record<string, string>
  /** Cloudflare-specific request init (cacheTtl, cacheEverything). Opaque. */
  cf?: Record<string, unknown>
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
