/**
 * Sign in to the local API as the dev admin `just setup` seeded, and print a
 * Cookie header for curl:
 *
 *   just dev-login
 *   curl -H "$(just dev-login)" http://localhost:8787/auth/get-session
 *
 * Reads apps/api/.env (via `just`'s --env-file). API_URL overrides the API
 * origin, e.g. for a second worktree's port.
 */

const env = process.env
if (env.NODE_ENV !== "development") {
  console.error(
    "dev-login: apps/api/.env has no NODE_ENV=development. Run `just setup`.",
  )
  process.exit(1)
}
const email = env.SEED_ADMIN_EMAIL
const password = env.SEED_ADMIN_PASSWORD
if (!email || !password) {
  console.error(
    "dev-login: no SEED_ADMIN_PASSWORD in apps/api/.env. Run `just setup` once to store the dev admin login.",
  )
  process.exit(1)
}
const api = env.API_URL ?? env.BETTER_AUTH_URL ?? "http://localhost:8787"
if (!/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(api)) {
  console.error(`dev-login: refusing a non-local API (${api}).`)
  process.exit(1)
}
// The API's origin guard wants a browser-like Origin from the web app.
const origin = (env.WEB_ORIGIN ?? "http://localhost:5173").split(",")[0]!

let res: Response
try {
  res = await fetch(`${api}/auth/sign-in/email`, {
    method: "POST",
    headers: { "content-type": "application/json", origin },
    body: JSON.stringify({ email, password }),
  })
} catch {
  console.error(
    `dev-login: can't reach ${api}. Is \`just dev\` (or \`just api\`) running?`,
  )
  process.exit(1)
}
if (!res.ok) {
  console.error(
    `dev-login: sign-in failed (${res.status}): ${await res.text()}. Re-run \`just setup\` to re-seed the admin.`,
  )
  process.exit(1)
}
const cookie = res.headers
  .getSetCookie()
  .map((c) => c.split(";")[0])
  .join("; ")
console.log(`Cookie: ${cookie}`)
