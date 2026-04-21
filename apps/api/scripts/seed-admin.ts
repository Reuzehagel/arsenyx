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

const EMAIL = "admin@admin.com"
const USERNAME = "admin"
const PASSWORD = "admin"

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set")
  const sql = neon(process.env.DATABASE_URL)

  const existing = (await sql`
    SELECT id, email FROM users
    WHERE email = ${EMAIL} OR username = ${USERNAME}
    LIMIT 1
  `) as Array<{ id: string; email: string }>
  if (existing.length > 0) {
    const row = existing[0]!
    if (row.email === EMAIL) {
      console.log(`✓ ${EMAIL} already exists — skipped`)
    } else {
      await sql`UPDATE users SET email = ${EMAIL} WHERE id = ${row.id}`
      console.log(`✓ migrated existing admin user → ${EMAIL}`)
    }
    return
  }

  const userId = nanoid()
  const accountId = nanoid()
  const passwordHash = await hashPassword(PASSWORD)

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

  console.log(`✓ seeded ${EMAIL} / ${PASSWORD} (admin)`)
}

main().catch((err) => {
  console.error("seed-admin failed:", err instanceof Error ? err.message : err)
  process.exit(1)
})
