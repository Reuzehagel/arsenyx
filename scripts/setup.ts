/**
 * Interactive first-run setup.
 *
 *   just setup
 *
 * Points this checkout at its own database in the local Postgres container
 * (compose.yaml, needs Docker) unless apps/api/.env already names a real one,
 * auto-generates everything else, pushes the schema, and seeds a local admin
 * user. Non-interactive and idempotent — re-run any time.
 */

import { randomBytes } from "node:crypto"
import { existsSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { basename, resolve } from "node:path"

const REPO = resolve(import.meta.dirname, "..")
const API_DIR = resolve(REPO, "apps/api")
const API_ENV = resolve(API_DIR, ".env")
const API_ENV_EXAMPLE = resolve(API_DIR, ".env.example")
const NODE_MODULES = resolve(REPO, "node_modules")
const SEARCH_MIGRATION = "scripts/migrations/2026-08-04_build_search_vector.sql"

const HEADER = `
Arsenyx dev setup
─────────────────
`

// Must match the BETTER_AUTH_SECRET placeholder value in apps/api/.env.example —
// if that string changes, update here too, or the wizard will treat the
// placeholder as a real secret and skip regeneration.
const SECRET_PLACEHOLDER = "generate with: openssl rand -base64 32"

// Known-shape-only. Handles the UPPER_SNAKE_CASE="value" lines in .env.example.
// Not a general-purpose .env parser — doesn't handle lowercase keys, multi-line
// values, or escaped quotes.
function parseEnv(text: string): Map<string, string> {
  const out = new Map<string, string>()
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const [, key, rawValue] = m
    const value = rawValue!.replace(/^["']|["']$/g, "")
    out.set(key!, value)
  }
  return out
}

function renderEnv(template: string, values: Map<string, string>): string {
  return template
    .split(/\r?\n/)
    .map((line) => {
      const m = line.match(/^(\s*)([A-Z0-9_]+)\s*=\s*.*$/)
      if (!m) return line
      const [, indent, key] = m
      if (!values.has(key!)) return line
      return `${indent}${key}="${values.get(key!)}"`
    })
    .join("\n")
}

function looksLikeRealPostgresUrl(url: string | undefined): boolean {
  if (!url) return false
  if (!url.startsWith("postgres")) return false
  if (url.includes("ep-xxx")) return false // the placeholder host
  return true
}

// Dev DBs are Neon or local; anything else (e.g. *.psdb.cloud = prod) must
// never get db:push or a seeded admin. Duplicated in apps/api/scripts/seed-admin.ts.
function isDevDbHost(url: string): boolean {
  const host = new URL(url).hostname
  return (
    host.endsWith(".neon.tech") ||
    ["localhost", "127.0.0.1", "::1", "[::1]"].includes(host)
  )
}

// One database per checkout, so parallel worktrees never share state.
function localDbUrl(): string {
  const slug = basename(REPO)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
  const db = `arsenyx_${slug}`.slice(0, 63)
  return `postgresql://postgres:postgres@localhost:54320/${db}?sslmode=disable`
}

async function run(
  cmd: string[],
  cwd: string,
  extraEnv: Record<string, string> = {},
): Promise<void> {
  const proc = Bun.spawn({
    cmd,
    cwd,
    env: { ...process.env, ...extraEnv },
    stdin: "inherit",
    stdout: "inherit",
    stderr: "inherit",
  })
  const code = await proc.exited
  if (code !== 0) {
    throw new Error(`${cmd.join(" ")} exited with code ${code}`)
  }
}

async function main() {
  console.log(HEADER)

  if (!existsSync(NODE_MODULES)) {
    console.log("› bun install (first time)\n")
    await run(["bun", "install"], REPO)
  } else {
    console.log("✓ bun install (already done)")
  }

  // Pre-commit format gate (.githooks/pre-commit); per-clone git config.
  await run(["git", "config", "core.hooksPath", ".githooks"], REPO)
  console.log("✓ git hooks enabled (.githooks)")

  if (!existsSync(API_ENV_EXAMPLE)) {
    throw new Error(`missing ${API_ENV_EXAMPLE}`)
  }
  const template = await readFile(API_ENV_EXAMPLE, "utf8")
  const existing = existsSync(API_ENV)
    ? parseEnv(await readFile(API_ENV, "utf8"))
    : new Map<string, string>()

  if (existing.size === 0) {
    console.log("› creating apps/api/.env from .env.example")
  } else {
    console.log("✓ apps/api/.env exists — updating")
  }

  // Default: this checkout's own database in the local container (compose.yaml).
  // An existing real URL (e.g. a Neon one) is kept.
  const currentDbUrl = existing.get("DATABASE_URL")
  let dbUrl = currentDbUrl
  if (!looksLikeRealPostgresUrl(currentDbUrl)) {
    dbUrl = localDbUrl()
    console.log(
      `✓ DATABASE_URL → local container (${new URL(dbUrl).pathname.slice(1)})`,
    )
  } else {
    console.log("✓ DATABASE_URL kept")
  }
  if (!isDevDbHost(dbUrl!)) {
    throw new Error(
      `DATABASE_URL host "${new URL(dbUrl!).hostname}" is not a dev database ` +
        `(*.neon.tech or localhost) — refusing to db:push / seed against it.`,
    )
  }

  const currentSecret = existing.get("BETTER_AUTH_SECRET") ?? ""
  let secret = currentSecret
  if (!currentSecret || currentSecret === SECRET_PLACEHOLDER) {
    secret = randomBytes(32).toString("base64")
    console.log("✓ BETTER_AUTH_SECRET generated")
  } else {
    console.log("✓ BETTER_AUTH_SECRET kept")
  }

  console.log(
    "✓ GITHUB_CLIENT_ID / SECRET left as-is (email+password dev login will work)",
  )

  // Single file: apps/api/.env. Wrangler 4.x auto-loads it into the Worker's
  // env bindings, and Prisma / the bun scripts read it too. Do NOT also write
  // a .dev.vars — wrangler treats its presence as an override that suppresses
  // .env entirely. NODE_ENV=development enables the dev-only email+password
  // sign-in path; wrangler.toml's [vars] overrides it to "production" on deploy.
  const nextValues = new Map(existing)
  nextValues.set("NODE_ENV", "development")
  nextValues.set("DATABASE_URL", dbUrl!)
  // The local Worker reaches the DB through this, not DATABASE_URL.
  nextValues.set(
    "CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE",
    dbUrl!,
  )
  nextValues.set("BETTER_AUTH_SECRET", secret)
  const rendered = renderEnv(template, nextValues)
  await writeFile(API_ENV, rendered, "utf8")
  console.log("✓ apps/api/.env written")

  if (new URL(dbUrl!).hostname === "localhost") {
    await run(["bun", "scripts/dev-db.ts", "ensure"], REPO)
  }

  console.log("\n› prisma db push\n")
  await run(["bun", "run", "db:push"], API_DIR, { DATABASE_URL: dbUrl! })

  // Search's trigger + GIN index live outside Prisma (docs/search.md). Idempotent.
  console.log("\n› search migration\n")
  await run(
    ["bunx", "prisma", "db", "execute", "--file", SEARCH_MIGRATION],
    API_DIR,
    { DATABASE_URL: dbUrl! },
  )

  console.log("\n› seeding admin user\n")
  // Generate fresh credentials per setup so the seeded admin never has the
  // historical hardcoded "admin/admin" defaults. Printed once; not persisted.
  const adminEmail = "admin@local.dev"
  const adminUsername = "admin"
  const { customAlphabet } = await import("nanoid")
  const genPw = customAlphabet(
    "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789",
    20,
  )
  const adminPassword = genPw()
  await run(["bun", "run", "scripts/seed-admin.ts"], API_DIR, {
    DATABASE_URL: dbUrl!,
    BETTER_AUTH_SECRET: secret,
    NODE_ENV: "development",
    SEED_ADMIN_EMAIL: adminEmail,
    SEED_ADMIN_USERNAME: adminUsername,
    SEED_ADMIN_PASSWORD: adminPassword,
  })

  if (new URL(dbUrl!).hostname === "localhost") {
    console.log("\n› sample data\n")
    await run(["bun", "run", "scripts/seed-sample.ts"], API_DIR, {
      DATABASE_URL: dbUrl!,
    })
  }

  console.log(`
All set — run \`just dev\`.
Sign in at http://localhost:5173 with:
  email:    ${adminEmail}
  password: ${adminPassword}
(Re-run \`just setup\` to rotate; not stored anywhere.)
`)
}

main().catch((err) => {
  console.error("\n✗ setup failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
