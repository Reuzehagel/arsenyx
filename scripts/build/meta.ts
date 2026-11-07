/**
 * The catalog's meta.json. `generatedAt` is the cache-bust version (the web
 * app's `?v=` stamp — apps/web/vite.config.ts `dataVersion()`); the counts
 * feed the build's count-regression gate (validate-output.ts).
 */

import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import { CATALOG_FILES } from "@arsenyx/shared/warframe/catalog-files"

export interface CatalogCounts {
  itemCount: number
  modCount: number
  arcaneCount: number
  perCategory: Record<string, number>
}

export interface CatalogMeta extends CatalogCounts {
  generatedAt: string
}

/** Counts of the emitted catalog. `perCategory` follows items-index key order. */
export function countsFromCatalog(
  itemsIndex: Record<string, readonly unknown[] | undefined>,
  mods: readonly unknown[],
  arcanes: readonly unknown[],
): CatalogCounts {
  const perCategory: Record<string, number> = {}
  for (const [cat, items] of Object.entries(itemsIndex))
    perCategory[cat] = items?.length ?? 0
  return {
    itemCount: Object.values(perCategory).reduce((a, b) => a + b, 0),
    modCount: mods.length,
    arcaneCount: arcanes.length,
    perCategory,
  }
}

/** Write meta.json with a fresh `generatedAt`: 2-space indent, no trailing
 *  newline, so a re-stamp diffs only the values that moved. */
export async function writeMeta(
  dir: string,
  counts: CatalogCounts,
): Promise<CatalogMeta> {
  const meta: CatalogMeta = { generatedAt: new Date().toISOString(), ...counts }
  await writeFile(
    resolve(dir, CATALOG_FILES.meta),
    JSON.stringify(meta, null, 2),
    "utf8",
  )
  return meta
}
