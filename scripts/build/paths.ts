/** On-disk locations the data pipeline reads and writes. */

import { resolve } from "node:path"

export const REPO_ROOT = resolve(import.meta.dirname, "../..")

/** The committed catalog, repo-relative — the form git pathspecs and
 *  `git show <ref>:<path>` take. */
export const CATALOG_DIR = "apps/web/public/data"

/** Where catalog scripts read and write. `CATALOG_OUT_DIR` redirects it to a
 *  snapshot dir (data:ab builds there) so the live catalog stays untouched. */
export const CATALOG_OUT_DIR = resolve(
  REPO_ROOT,
  process.env.CATALOG_OUT_DIR ?? CATALOG_DIR,
)

/** Mirrors written by sync-de.ts / sync-wiki.ts; the build never fetches. */
export const RAW_DE_DIR = resolve(REPO_ROOT, "data/raw/de")
export const RAW_WIKI_DIR = resolve(REPO_ROOT, "data/raw/wiki")

/** Wiki image filename → URL cache that build:items maintains. */
export const WIKI_IMAGE_CACHE = resolve(
  REPO_ROOT,
  "data/curated/wiki-image-urls.json",
)

/** Upstream version pins, one section per sync script (see pins.ts). */
export const PINS_PATH = resolve(REPO_ROOT, "data/PINS.json")
