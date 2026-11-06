/** The local dev Postgres (compose.yaml) every checkout gets a database in. */

export const LOCAL_DB_HOST = "localhost"
export const LOCAL_DB_PORT = "54320"

export function localDbUrl(db: string): string {
  return `postgresql://postgres:postgres@${LOCAL_DB_HOST}:${LOCAL_DB_PORT}/${db}?sslmode=disable`
}

/** Exactly the compose.yaml container — the only DB scripts/dev-db.ts will
 *  create or drop, so setup.ts gates `ensure` and sample data on it too. */
export function isComposeDbUrl(url: string | undefined): boolean {
  if (!url) return false
  const { hostname, port } = new URL(url)
  return hostname === LOCAL_DB_HOST && port === LOCAL_DB_PORT
}

/** Any loopback Postgres, as opposed to a Neon dev copy. */
export function isLocalDbUrl(url: string | undefined): boolean {
  if (!url) return false
  return ["localhost", "127.0.0.1", "::1", "[::1]"].includes(
    new URL(url).hostname,
  )
}

/** Dev DBs are Neon or local; anything else (e.g. *.psdb.cloud = prod) must
 *  never get db:push or a seeded admin. Used by setup.ts and
 *  apps/api/scripts/seed-admin.ts. */
export function isDevDbUrl(url: string | undefined): boolean {
  if (!url) return false
  return new URL(url).hostname.endsWith(".neon.tech") || isLocalDbUrl(url)
}

/** workerd (wrangler ≥4.157) tries ::1 first for "localhost" and stalls ~2 s
 *  per connection before falling back, so the local Worker's Hyperdrive
 *  string pins IPv4. */
export function pinIpv4(url: string): string {
  return url.replace("@localhost:", "@127.0.0.1:")
}

/** Repoints the Hyperdrive line of an .env written before setup.ts pinned
 *  IPv4; returns the text unchanged when already pinned or absent. */
export function pinHyperdriveIpv4(env: string): string {
  return env.replace(
    /^(CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE\s*=\s*"?)([^"\r\n]*)/m,
    (_, key: string, url: string) => key + pinIpv4(url),
  )
}
