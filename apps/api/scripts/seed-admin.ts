/**
 * Idempotently seed a local dev admin user.
 *
 * Invoked by scripts/setup.ts at the end of `just setup`. Safe to re-run.
 *
 * Bypasses Prisma entirely because the API's Prisma client is generated with
 * `runtime = "workerd"` and won't load outside wrangler. Talks to Neon via
 * @neondatabase/serverless and hashes the password with Better Auth's own
 * utility so the resulting account is indistinguishable from one created via
 * `/auth/sign-up/email`.
 */

import { neon } from "@neondatabase/serverless"
import { hashPassword } from "better-auth/crypto"
import { nanoid } from "nanoid"

// Refuse to run outside local development. A misconfigured NODE_ENV in CI/prod
// would otherwise create a known-credential admin account.
if (process.env.NODE_ENV !== "development") {
  console.error(
    `seed-admin refuses to run with NODE_ENV="${process.env.NODE_ENV ?? ""}". Only "development" is allowed.`,
  )
  process.exit(1)
}

const EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@local.dev"
const USERNAME = process.env.SEED_ADMIN_USERNAME ?? "admin"
// If no password is supplied via env, generate a fresh random one each run so
// no static "admin/admin" credential ever lands in code or shell history.
const PASSWORD_FROM_ENV = process.env.SEED_ADMIN_PASSWORD
const PASSWORD = PASSWORD_FROM_ENV ?? nanoid(20)

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set")
  const sql = neon(process.env.DATABASE_URL)

  const passwordHash = await hashPassword(PASSWORD)

  // Match strictly by email. Matching on username too (the previous behaviour)
  // would clobber a developer's real local user if they happened to pick the
  // same username — we'd email-migrate them and overwrite their password hash.
  const existing = (await sql`
    SELECT id FROM users WHERE email = ${EMAIL} LIMIT 1
  `) as Array<{ id: string }>
  if (existing.length > 0) {
    const row = existing[0]!
    // Upsert the credential row: an OAuth-only user (no providerId='credential'
    // row) needs one created; an existing credential row gets its password
    // rotated so the freshly-printed password actually works.
    const updated = (await sql`
      UPDATE accounts
      SET password = ${passwordHash}, "updatedAt" = NOW()
      WHERE "userId" = ${row.id} AND "providerId" = 'credential'
      RETURNING id
    `) as Array<{ id: string }>
    if (updated.length === 0) {
      await sql`
        INSERT INTO accounts (
          id, "userId", "accountId", "providerId", password,
          "createdAt", "updatedAt"
        ) VALUES (
          ${nanoid()}, ${row.id}, ${row.id}, 'credential', ${passwordHash},
          NOW(), NOW()
        )
      `
      if (!PASSWORD_FROM_ENV) {
        console.log(`✓ ${EMAIL} credential added → ${PASSWORD}`)
      } else {
        console.log(`✓ ${EMAIL} credential added`)
      }
      return
    }
    if (!PASSWORD_FROM_ENV) {
      console.log(`✓ ${EMAIL} password rotated → ${PASSWORD}`)
    } else {
      console.log(`✓ ${EMAIL} password rotated`)
    }
    return
  }

  // Refuse to clobber another user that already owns the requested username.
  // (The seed previously took it over; safer to fail loudly.)
  const usernameClash = (await sql`
    SELECT id FROM users WHERE username = ${USERNAME} LIMIT 1
  `) as Array<{ id: string }>
  if (usernameClash.length > 0) {
    console.error(
      `seed-admin: username "${USERNAME}" is already taken by a different user — refusing to overwrite. ` +
        `Set SEED_ADMIN_USERNAME to a different value or delete the existing row.`,
    )
    process.exit(1)
  }

  const userId = nanoid()
  const accountId = nanoid()

  await sql`
    INSERT INTO users (
      id, name, email, "emailVerified",
      username, "displayUsername",
      "isAdmin", "isVerified",
      "defaultBuildVisibility", "createdAt", "updatedAt"
    ) VALUES (
      ${userId}, ${USERNAME}, ${EMAIL}, true,
      ${USERNAME}, ${USERNAME},
      true, true,
      'PUBLIC', NOW(), NOW()
    )
  `

  await sql`
    INSERT INTO accounts (
      id, "userId", "accountId", "providerId", password,
      "createdAt", "updatedAt"
    ) VALUES (
      ${accountId}, ${userId}, ${userId}, 'credential', ${passwordHash},
      NOW(), NOW()
    )
  `

  if (!PASSWORD_FROM_ENV) {
    console.log(`✓ seeded ${EMAIL} / ${PASSWORD} (admin)`)
  } else {
    console.log(`✓ seeded ${EMAIL} (admin)`)
  }
}

main().catch((err) => {
  console.error("seed-admin failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
