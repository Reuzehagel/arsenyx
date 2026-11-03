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

import { existsSync, readFileSync } from "node:fs"
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
        `(localhost:54320) — refusing to touch it.`,
    )
  }
  return url.pathname.slice(1)
}

async function main() {
  const cmd = process.argv[2]
  if (cmd !== "ensure" && cmd !== "reset") {
    throw new Error("usage: bun scripts/dev-db.ts ensure|reset")
  }
  const db = checkoutDb()
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
