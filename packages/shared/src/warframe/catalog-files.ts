// File names of the static catalog that scripts/build-items-index.ts writes
// into apps/web/public/data/ and the web app + edge Worker fetch from /data/.

export const CATALOG_FILES = {
  itemsIndex: "items-index.json",
  mods: "mods-all.json",
  modTradable: "mod-tradable.json",
  modConflicts: "mod-conflicts.json",
  arcanes: "arcanes-all.json",
  helminthAbilities: "helminth-abilities.json",
  imageMap: "image-map.json",
  incarnonEvolutions: "incarnon-evolutions.json",
  modular: "modular.json",
  zawImages: "zaw-images.json",
  kitgunImages: "kitgun-images.json",
  incarnonAdapterImages: "incarnon-adapter-images.json",
  meta: "meta.json",
  report: "_report.json",
} as const

/** Directory of per-item detail files: `items/<category>/<slug>.json`. */
export const ITEM_DETAIL_DIR = "items"

/** Site path a catalog file is served from. */
export function catalogUrl(file: string): string {
  return `/data/${file}`
}

/** Site path of one item's detail file. `slug` is used verbatim; callers
 *  that take it from user input encode it first. */
export function itemDetailUrl(category: string, slug: string): string {
  return catalogUrl(`${ITEM_DETAIL_DIR}/${category}/${slug}.json`)
}

/** The `?v=` catalog version (`__DATA_VERSION__`): meta.json's `generatedAt`
 *  as epoch ms, "0" when meta.json is absent (fresh checkout before
 *  build:items) or unreadable. */
export function dataVersionFromMeta(metaJson: string | undefined): string {
  try {
    const meta = JSON.parse(metaJson ?? "") as { generatedAt?: string }
    const ts = Date.parse(meta.generatedAt ?? "")
    if (!Number.isNaN(ts)) return String(ts)
  } catch {
    // fall through
  }
  return "0"
}
