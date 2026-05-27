/**
 * Resolve `imageName` for an item by looking up its `uniqueName` in DE's
 * `ExportManifest.json`. The manifest maps to `textureLocation` paths like
 *   `/Lotus/Interface/Icons/StoreIcons/Weapons/.../CodaBubonico.png!00_<hash>`
 * The "!<hash>" suffix is a cache-busting query; the bare filename is what
 * the existing pipeline emits.
 */

import type { DeManifestEntry } from "./read-de"

export function buildImageLookup(
  manifest: DeManifestEntry[],
): Map<string, string> {
  const out = new Map<string, string>()
  for (const ent of manifest) {
    const loc = ent.textureLocation
    if (typeof loc !== "string") continue
    // Strip ` !hash` cache suffix.
    const noHash = loc.split("!")[0] ?? loc
    // Take the basename.
    const idx = noHash.lastIndexOf("/")
    const file = idx >= 0 ? noHash.slice(idx + 1) : noHash
    if (file) out.set(ent.uniqueName, file)
  }
  return out
}
