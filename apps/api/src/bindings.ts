// Cloudflare Workers bindings declared in wrangler.toml.
//
// The Hono app itself isn't generically typed (env stays `unknown` on the
// fetch handler), so callsites cast `c.env as Bindings` where they need a
// specific binding. Centralised here so a typo in wrangler.toml shows up as
// a TS error on first use rather than a 500 at runtime.

interface RateLimitBinding {
  limit(opts: { key: string }): Promise<{ success: boolean }>
}

export interface Bindings {
  // Workers Rate Limiting API — the `simple` form returns only `success`.
  // Configured in wrangler.toml under [[unsafe.bindings]].
  ANON_SEARCH_LIMITER: RateLimitBinding
  ANON_READ_LIMITER: RateLimitBinding
}
