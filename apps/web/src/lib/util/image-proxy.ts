import { API_URL } from "./constants"

// Wraps a user-supplied image URL so the browser fetches it from our own API
// origin rather than the third-party host. Without the proxy, an org/profile
// admin could point `image` at a server they control and silently log every
// visitor's IP and Referer when the avatar loads.
//
// We originally targeted Cloudflare's /cdn-cgi/image/... endpoint, but the
// free plan only supports it for assets stored in Cloudflare Images — for
// arbitrary external URLs CF returns 403. We now route through a tiny Hono
// handler at `${API_URL}/img?u=<encoded>` (see apps/api/src/routes/img.ts)
// that fetches server-side, enforces a size cap, and refuses non-image
// content types. The proxy returns the source bytes verbatim (no resizing).

function isProxyable(src: string): boolean {
  // Absolute http(s) OR protocol-relative (`//host/...`) URLs get proxied.
  // data:, blob:, and relative paths (e.g. local placeholders) pass through.
  return /^(https?:)?\/\//i.test(src)
}

export function proxyImage(src: string | null | undefined): string | null {
  if (!src) return null
  if (!isProxyable(src)) return src
  // Normalize a protocol-relative URL (`//host/x`) to https before proxying.
  // Left as-is, the browser resolves it against the page origin and fetches it
  // directly — leaking the visitor's IP / Referer, the exact doxxing vector
  // the proxy exists to close.
  const absolute = src.startsWith("//") ? `https:${src}` : src
  return `${API_URL}/img?u=${encodeURIComponent(absolute)}`
}
