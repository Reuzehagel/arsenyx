/**
 * Refresh `itemImageName` on every build to match the current static
 * items-index. Old builds stored slug+hash filenames (e.g.
 * `ash-prime-bfcb09331e.png`) that the WFCD CDN no longer serves; the
 * upstream package now exposes PascalCase names (e.g. `AshPrime.png`).
 *
 * Idempotent: skips rows already in sync.
 */

import { readFileSync } from "node:fs"
import { join } from "node:path"

import type { BrowseItem } from "@arsenyx/shared/warframe/types"
import { neon } from "@neondatabase/serverless"

async function main() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not set")

  const indexPath = join(
    import.meta.dir,
    "../../../apps/web/public/data/items-index.json",
  )
  const index = JSON.parse(readFileSync(indexPath, "utf8")) as Record<
    string,
    BrowseItem[]
  >

  const byUniqueName = new Map<string, string | null>()
  for (const list of Object.values(index)) {
    for (const item of list) {
      byUniqueName.set(item.uniqueName, item.imageName ?? null)
    }
  }

  const sql = neon(process.env.DATABASE_URL)
  const rows = (await sql`
    SELECT id, "itemUniqueName", "itemImageName"
    FROM builds
  `) as Array<{
    id: string
    itemUniqueName: string
    itemImageName: string | null
  }>

  const updates: Array<{ id: string; fresh: string | null }> = []
  let skipped = 0
  let missing = 0
  for (const row of rows) {
    const fresh = byUniqueName.get(row.itemUniqueName)
    if (fresh === undefined) missing++
    else if (fresh === row.itemImageName) skipped++
    else updates.push({ id: row.id, fresh })
  }

  await Promise.all(
    updates.map(
      ({ id, fresh }) =>
        sql`UPDATE builds SET "itemImageName" = ${fresh} WHERE id = ${id}`,
    ),
  )

  console.log(
    `✓ backfill complete: updated=${updates.length} skipped=${skipped} missing=${missing}`,
  )
  if (missing > 0) {
    console.log(
      `  (missing = build's itemUniqueName not present in items-index; manual triage)`,
    )
  }
}

main().catch((err) => {
  console.error(
    "backfill failed:",
    err instanceof Error ? err.message : err,
  )
  process.exit(1)
})
