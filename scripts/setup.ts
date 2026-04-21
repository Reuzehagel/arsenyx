/**
 * Interactive first-run setup.
 *
 *   just setup
 *
 * Walks a new contributor through the only decision they need to make
 * (pasting a Neon DATABASE_URL), auto-generates everything else, pushes
 * the schema, and seeds a local admin user. Idempotent — re-run any time.
 */

import { randomBytes } from "node:crypto"
import { existsSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const REPO = resolve(import.meta.dirname, "..")
const API_DIR = resolve(REPO, "apps/api")
const API_ENV = resolve(API_DIR, ".env")
const API_DEV_VARS = resolve(API_DIR, ".dev.vars")
const API_ENV_EXAMPLE = resolve(API_DIR, ".env.example")
const NODE_MODULES = resolve(REPO, "node_modules")

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

function ask(question: string, fallback?: string): string {
  const suffix = fallback ? ` [${fallback}]` : ""
  const raw = prompt(`${question}${suffix}`)
  if (raw === null) {
    throw new Error(
      "stdin closed — run `just setup` in an interactive terminal",
    )
  }
  return raw.trim() || fallback || ""
}

async function main() {
  console.log(HEADER)

  if (!existsSync(NODE_MODULES)) {
    console.log("› bun install (first time)\n")
    await run(["bun", "install"], REPO)
  } else {
    console.log("✓ bun install (already done)")
  }

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

  const currentDbUrl = existing.get("DATABASE_URL")
  let dbUrl = currentDbUrl
  if (!looksLikeRealPostgresUrl(currentDbUrl)) {
    console.log(`
DATABASE_URL
  Need a free Postgres? Go to https://neon.tech, create a project,
  copy the UNPOOLED connection string (ends in .neon.tech, no -pooler).
`)
    while (!looksLikeRealPostgresUrl(dbUrl)) {
      dbUrl = ask("  DATABASE_URL:").trim()
      if (!looksLikeRealPostgresUrl(dbUrl)) {
        console.log("  ✗ doesn't look like a postgres URL — try again.")
      }
    }
  } else {
    console.log("✓ DATABASE_URL kept")
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

  // Prisma CLI reads .env; wrangler dev reads .dev.vars only. Same content,
  // two files. NODE_ENV=development enables the dev-only email+password
  // sign-in path; wrangler.toml's [vars] overrides it to "production" on deploy.
  const nextValues = new Map(existing)
  nextValues.set("NODE_ENV", "development")
  nextValues.set("DATABASE_URL", dbUrl!)
  nextValues.set("BETTER_AUTH_SECRET", secret)
  const rendered = renderEnv(template, nextValues)
  await Promise.all([
    writeFile(API_ENV, rendered, "utf8"),
    writeFile(API_DEV_VARS, rendered, "utf8"),
  ])
  console.log("✓ apps/api/.env + apps/api/.dev.vars written")

  console.log("\n› prisma db push\n")
  await run(["bun", "run", "db:push"], API_DIR, { DATABASE_URL: dbUrl! })

  console.log("\n› seeding admin user\n")
  await run(["bun", "run", "scripts/seed-admin.ts"], API_DIR, {
    DATABASE_URL: dbUrl!,
    BETTER_AUTH_SECRET: secret,
    NODE_ENV: "development",
  })

  console.log(`
All set — run \`just dev\`.
Sign in at http://localhost:5173 with admin@admin.com / admin.
`)
}

main().catch((err) => {
  console.error("\n✗ setup failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
