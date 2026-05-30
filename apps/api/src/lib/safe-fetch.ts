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
  /**
   * Resolve each target hostname via DoH and reject answers in
   * private/loopback/link-local/CGNAT/ULA ranges. Defends against DNS names
   * that point at internal IPs.
   */
  blockPrivateDns?: boolean
}

/**
 * Returns true if `ip` is in a private, loopback, link-local, CGNAT, or ULA
 * range and therefore must never be reachable through the proxy.
 */
export function isPrivateIp(ip: string): boolean {
  // IPv4 dotted-quad.
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

  // IPv6 (expects lowercase).
  const v6 = ip.toLowerCase()
  if (v6 === "::1" || v6 === "::") return true
  if (v6.startsWith("fe80")) return true // link-local
  if (v6.startsWith("fc") || v6.startsWith("fd")) return true // ULA fc00::/7
  // IPv4-mapped IPv6: ::ffff:a.b.c.d — recurse into the embedded IPv4.
  const mapped = /^::ffff:(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/.exec(v6)
  if (mapped) return isPrivateIp(mapped[1])

  return false
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
  const {
    isAllowed,
    maxBytes,
    timeoutMs,
    maxRedirects = 0,
    headers,
    cf,
    blockPrivateDns = false,
  } = opts

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

  // Resolve the hostname before the first fetch. By this point the host is
  // always a DNS name (the caller's allowlist / validateExternalUrl rejects IP
  // literals); the point is to catch names whose A/AAAA records resolve to
  // internal addresses.
  if (blockPrivateDns) {
    const hostname = new URL(current).hostname
    if (await hostnameResolvesToPrivate(hostname, timeoutMs)) {
      throw new SafeFetchError("private_host")
    }
  }

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
    if (blockPrivateDns) {
      const nextHostname = new URL(next).hostname
      if (await hostnameResolvesToPrivate(nextHostname, timeoutMs)) {
        throw new SafeFetchError("private_host")
      }
    }
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
