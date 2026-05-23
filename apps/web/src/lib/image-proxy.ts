// Wraps a user-supplied image URL with Cloudflare Image Resizing so the
// browser fetches the asset from our own origin rather than the third-party
// host. Without the proxy, an org/profile admin could point `image` at a
// server they control and silently log every visitor's IP and Referer when
// the avatar loads. The proxy also gives us free format negotiation (avif/
// webp) and on-the-fly resizing.
//
// URL shape (CF docs):
//   /cdn-cgi/image/<comma-separated-options>/<source-url>
//
// Image Resizing must be enabled on the zone (Cloudflare dashboard →
// Speed → Optimization). In local dev or when the feature is disabled,
// Cloudflare returns the source URL unchanged, so this stays safe-by-default
// behaviour-wise but DOES leak the visitor IP in those environments.

type ProxyOptions = {
  /** Target render size in CSS pixels (CF will pick 1x/2x via dpr). */
  width?: number
  height?: number
  /** "cover" matches our existing object-cover usage. */
  fit?: "cover" | "contain" | "scale-down" | "crop"
}

const DEFAULT_OPTIONS: Required<Pick<ProxyOptions, "fit">> = { fit: "cover" }

function isProxyable(src: string): boolean {
  // Only proxy absolute http(s) URLs. data:, blob:, and relative paths
  // (e.g. local placeholders) pass through unchanged.
  return /^https?:\/\//i.test(src)
}

export function proxyImage(
  src: string | null | undefined,
  opts: ProxyOptions = {},
): string | null {
  if (!src) return null
  if (!isProxyable(src)) return src

  const parts: string[] = [
    `fit=${opts.fit ?? DEFAULT_OPTIONS.fit}`,
    "format=auto",
  ]
  if (opts.width) parts.push(`width=${opts.width}`)
  if (opts.height) parts.push(`height=${opts.height}`)
  // dpr=2 lets the browser pick a sharper variant on high-density screens
  // without us having to wire up srcset for every avatar callsite.
  parts.push("dpr=2")

  // Source URLs are encoded so that `?`, `#`, and `..` inside them survive
  // browser URL parsing. Without this, Discord (`?ex=…&hm=…&is=…`) and
  // GitHub avatar (`?v=4`) URLs lose their query string before reaching
  // Cloudflare, and `..` segments get path-normalised into garbage.
  return `/cdn-cgi/image/${parts.join(",")}/${encodeURIComponent(src)}`
}
