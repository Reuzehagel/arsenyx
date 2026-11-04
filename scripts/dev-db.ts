/**
 * Local dev Postgres (compose.yaml). Every checkout/worktree gets its own
 * database in one shared container, named in its apps/api/.env DATABASE_URL.
 *
 *   bun scripts/dev-db.ts ensure  start the container, create this checkout's DB if missing
 *   bun scripts/dev-db.ts reset   drop and recreate this checkout's DB (empty)
 *
 * `just setup` then pushes the schema, applies the search migration and seeds
 * the admin + sample data on top. Refuses any non-local DATABASE_URL.
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const REPO = resolve(import.meta.dirname, "..")
const API_ENV = resolve(REPO, "apps/api/.env")

async function run(cmd: string[]) {
  const proc = Bun.spawn({
    cmd,
    cwd: REPO,
    stdio: ["inherit", "inherit", "inherit"],
  })
  const code = await proc.exited
  if (code !== 0)
    throw new Error(`${cmd.slice(0, 4).join(" ")} … exited with code ${code}`)
}

// `-T`: no TTY, so this works from scripts and pipes.
const psql = (sql: string) =>
  run([
    "docker",
    "compose",
    "exec",
    "-T",
    "db",
    "psql",
    "-U",
    "postgres",
    "-v",
    "ON_ERROR_STOP=1",
    "-q",
    "-c",
    "SET client_min_messages = warning",
    "-c",
    sql,
  ])

function checkoutDb(): string {
  const env = existsSync(API_ENV) ? readFileSync(API_ENV, "utf8") : ""
  const raw = env.match(/^DATABASE_URL\s*=\s*"?([^"\r\n]*)"?/m)?.[1]
  if (!raw)
    throw new Error("no DATABASE_URL in apps/api/.env — run `just setup`")
  const url = new URL(raw)
  if (url.hostname !== "localhost" || url.port !== "54320") {
    throw new Error(
      `DATABASE_URL host "${url.hostname}:${url.port}" is not the local dev container ` +
        `(localhost:54320) — refusing to touch it. Run \`just setup\` to repoint this checkout.`,
    )
  }
  return url.pathname.slice(1)
}

// Repoint .env files written before setup.ts pinned IPv4: under wrangler ≥4.157
// workerd tries ::1 first for "localhost" and every request stalls ~2 s.
function pinHyperdriveIpv4() {
  const env = readFileSync(API_ENV, "utf8")
  const fixed = env.replace(
    /^(CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE\s*=\s*"?postgres(?:ql)?:\/\/[^@\s"]*)@localhost:/m,
    "$1@127.0.0.1:",
  )
  if (fixed === env) return
  writeFileSync(API_ENV, fixed, "utf8")
  console.log("✓ apps/api/.env: Hyperdrive local string → 127.0.0.1")
}

async function main() {
  const cmd = process.argv[2]
  if (cmd !== "ensure" && cmd !== "reset") {
    throw new Error("usage: bun scripts/dev-db.ts ensure|reset")
  }
  const db = checkoutDb()
  pinHyperdriveIpv4()
  await run(["docker", "compose", "up", "-d", "--wait", "--quiet-pull"])
  if (cmd === "reset")
    await psql(`DROP DATABASE IF EXISTS "${db}" WITH (FORCE)`)
  // CREATE DATABASE has no IF NOT EXISTS; \gexec runs it only when the row is missing.
  await run([
    "docker",
    "compose",
    "exec",
    "-T",
    "db",
    "sh",
    "-c",
    `echo "SELECT 'CREATE DATABASE \\"${db}\\"' WHERE NOT EXISTS ` +
      `(SELECT FROM pg_database WHERE datname = '${db}')\\gexec" | psql -U postgres -q -v ON_ERROR_STOP=1`,
  ])
  console.log(`✓ ${db} ready`)
}

main().catch((err) => {
  console.error("\n✗ dev-db failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
