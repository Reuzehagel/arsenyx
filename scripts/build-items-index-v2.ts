/**
 * Phase 4 full output: produce the v2 items-index + per-item detail files
 * + mods-all.json by merging DE + wiki + curated.
 *
 * Lands beside the existing build under
 * `apps/web/public/data/v2/` so the live site keeps reading the old shape
 * while Phase 5 migrates consumers.
 *
 * Schema deviations from the existing `apps/web/public/data/`:
 *   - BrowseItem gets `displayClass` (was `type`).
 *   - Per-item weapon detail gets `modPools`, `compatTags`, `polarities`,
 *     `family`, `traits` (new fields from the wiki merge).
 *   - Polarities everywhere are lowercase full names ("naramon", not "V").
 *
 * Schema fields kept stable: uniqueName, name, slug, category, imageName,
 * masteryReq, isPrime, vaulted, releaseDate.
 */

import { mkdir, rm, writeFile } from "node:fs/promises"
import { readdirSync } from "node:fs"
import { resolve } from "node:path"

import { slugify } from "@arsenyx/shared/warframe/slugs"

import {
  buildExaltedSet,
  categorizeCompanion,
  categorizeFrame,
  categorizeWeapon,
  type BrowseCategory,
} from "./build/categorize"
import { buildImageLookup } from "./build/images"
import { mergeArcanes, type MergedArcane } from "./build/merge-arcanes"
import { mergeCompanions, type MergedCompanion } from "./build/merge-companions"
import { mergeFrame, operatorsFromWiki, type MergedFrame } from "./build/merge-frames"
import { deriveHelminthAbilities } from "./build/merge-helminth"
import { mergeMods, type MergedMod } from "./build/merge-mods"
import {
  mergeWeapon,
  mergeWikiOnlyWeapon,
  validateCuratedAgainstKnown,
  type MergedWeapon,
} from "./build/merge-weapons"
import {
  readDeArcanes,
  readDeFrames,
  readDeManifest,
  readDeSentinels,
  readDeUpgrades,
  readDeWeapons,
  type DeSentinel,
} from "./build/read-de"
import { readCurated } from "./build/read-curated"
import { readWikiModule } from "./build/read-wiki"

const REPO_ROOT = resolve(import.meta.dirname, "..")
const WIKI_DIR = resolve(REPO_ROOT, "data/raw/wiki")
const OUT_DIR = resolve(REPO_ROOT, "apps/web/public/data/v2")
const DETAIL_DIR = resolve(OUT_DIR, "items")

interface BrowseItemV2 {
  uniqueName: string
  name: string
  slug: string
  category: BrowseCategory
  imageName?: string
  masteryReq?: number
  isPrime?: boolean
  vaulted?: boolean
  /** Wiki Class for weapons; "Warframe"/"Necramech"/"Archwing"/"Operator"
   *  for frames; companion subtype label for pets. Replaces legacy `type`. */
  displayClass?: string
  releaseDate?: string
}

interface BuildStats {
  weapons: { de: number; merged: number; emitted: number; unmatched: number }
  frames: { de: number; merged: number; emitted: number; operators: number }
  companions: { wiki: number; deOnly: number }
  mods: { de: number; kept: number }
  perCategory: Record<string, number>
}

const stats: BuildStats = {
  weapons: { de: 0, merged: 0, emitted: 0, unmatched: 0 },
  frames: { de: 0, merged: 0, emitted: 0, operators: 0 },
  companions: { wiki: 0, deOnly: 0 },
  mods: { de: 0, kept: 0 },
  perCategory: {},
}

function frameDisplayClass(f: MergedFrame): string {
  switch (f.category) {
    case "warframes":
      return "Warframe"
    case "necramechs":
      return "Necramech"
    case "archwing":
      return "Archwing"
    case "operators":
      return "Operator"
  }
}

async function main() {
  console.log(`Output dir: ${OUT_DIR}\n`)

  // ---------- 1. Read everything from disk ----------
  const curated = readCurated()
  validateCuratedAgainstKnown(curated)

  const deWeapons = readDeWeapons()
  const deFramesBlob = readDeFrames()
  const deSentinelsBlob = readDeSentinels()
  const deManifest = readDeManifest()
  const deUpgrades = readDeUpgrades()
  console.log(`DE: ${deWeapons.length} weapons, ${deFramesBlob.ExportWarframes.length} frames, ${deSentinelsBlob.ExportSentinels.length} sentinel-blob rows, ${deUpgrades.ExportUpgrades?.length ?? 0} upgrades`)

  // Wiki weapon subpages — flat name → entry map.
  const wikiWeaponsByName = new Map<string, Record<string, unknown>>()
  for (const f of readdirSync(WIKI_DIR).filter(
    (n) => n.startsWith("Weapons_data_") && n.endsWith(".lua"),
  )) {
    const m = readWikiModule(resolve(WIKI_DIR, f))
    for (const [n, e] of Object.entries(m)) {
      if (e && typeof e === "object") {
        wikiWeaponsByName.set(n, e as Record<string, unknown>)
      }
    }
  }
  console.log(`Wiki weapons (across subpages): ${wikiWeaponsByName.size} unique names`)

  const wikiFramesBlob = readWikiModule(resolve(WIKI_DIR, "Warframes_data.lua")) as {
    Warframes?: Record<string, Record<string, unknown>>
    Archwings?: Record<string, Record<string, unknown>>
    Necramechs?: Record<string, Record<string, unknown>>
    Operators?: Record<string, Record<string, unknown>>
  }

  const wikiCompanionsBlob = readWikiModule(
    resolve(WIKI_DIR, "Companions_data.lua"),
  ) as { Companions?: Record<string, Record<string, unknown>> }
  const wikiCompanions = wikiCompanionsBlob.Companions ?? {}
  console.log(`Wiki: ${Object.keys(wikiFramesBlob.Warframes ?? {}).length} warframes, ${Object.keys(wikiCompanions).length} companions`)

  // ---------- 2. Merge weapons ----------
  const weaponUnmatched = new Set<string>()
  const mergedWeapons: MergedWeapon[] = []
  const seenWikiNames = new Set<string>()
  for (const de of deWeapons) {
    const merged = mergeWeapon(de, {
      curated,
      wikiByName: wikiWeaponsByName,
      unmatched: weaponUnmatched,
    })
    mergedWeapons.push(merged)
    // Track which wiki names we paired with a DE row (the merge step
    // strips `<ARCHWING> ` prefixes, so `merged.name` is the wiki key).
    seenWikiNames.add(merged.name)
    // Aliases also count as matched.
    const alias = curated.wikiAliases[merged.name]
    if (alias) seenWikiNames.add(alias)
  }
  // Wiki-only entries: things like beast claws (Adarza Claws, Chesa
  // Claws, ...) that DE doesn't export but the wiki documents fully.
  let wikiOnlyEmitted = 0
  for (const [name, wiki] of wikiWeaponsByName) {
    if (seenWikiNames.has(name)) continue
    // Skip wiki entries we don't want as standalone items (modular parts
    // with no Slot, sub-pages without Class, etc.).
    const w = wiki as { Class?: string; Slot?: string }
    if (!w.Class || !w.Slot) continue
    mergedWeapons.push(mergeWikiOnlyWeapon(name, wiki, curated))
    wikiOnlyEmitted++
  }
  console.log(`Wiki-only weapons emitted: ${wikiOnlyEmitted}`)
  stats.weapons.de = deWeapons.length
  stats.weapons.merged = mergedWeapons.length
  stats.weapons.unmatched = weaponUnmatched.size

  // ---------- 3. Merge frames ----------
  const frameUnmatched = new Set<string>()
  const mergedFrames: MergedFrame[] = []
  for (const de of deFramesBlob.ExportWarframes) {
    mergedFrames.push(mergeFrame(de, { wiki: wikiFramesBlob, unmatched: frameUnmatched }))
  }
  const operators = operatorsFromWiki(wikiFramesBlob)
  stats.frames.de = deFramesBlob.ExportWarframes.length
  stats.frames.merged = mergedFrames.length
  stats.frames.operators = operators.length

  // ---------- 4. Merge companions ----------
  const deCompanionByName = new Map<string, DeSentinel>()
  for (const ent of deSentinelsBlob.ExportSentinels) {
    if (ent.productCategory === "Sentinels" || ent.productCategory === "KubrowPets") {
      deCompanionByName.set(ent.name, ent)
    }
  }
  const { companions: mergedCompanions, unmatchedDeNames } = mergeCompanions({
    wikiCompanions,
    deByName: deCompanionByName,
  })
  stats.companions.wiki = mergedCompanions.length
  stats.companions.deOnly = unmatchedDeNames.length

  // Image lookup needs to be ready before arcane merge fills imageName.
  const imageByUniqueName = buildImageLookup(deManifest)

  // ---------- 5. Merge mods + arcanes ----------
  const { mods: mergedMods, counts: modCounts } = mergeMods(
    deUpgrades.ExportUpgrades ?? [],
    deUpgrades.ExportModSet ?? [],
  )
  stats.mods.de = modCounts.total
  stats.mods.kept = modCounts.kept

  const deArcanes = readDeArcanes()
  const mergedArcanes = mergeArcanes(deArcanes.ExportRelicArcane ?? [])
  // Image fill from manifest
  const arcanesWithImages = mergedArcanes.map((a) => ({
    ...a,
    imageName: imageByUniqueName.get(a.uniqueName),
  }))

  // ---------- 6. Image lookup ----------
  // (defined before step 5 in the code flow so arcane merge can use it,
  //  but conceptually a step-6 concern — kept here for readability)
  void 0

  // ---------- 7. Build items-index.json ----------
  const byCategory: Partial<Record<BrowseCategory, BrowseItemV2[]>> = {}
  function push(cat: BrowseCategory, item: BrowseItemV2): void {
    if (!byCategory[cat]) byCategory[cat] = []
    byCategory[cat]!.push(item)
  }

  // Frames
  for (const f of [...mergedFrames, ...operators]) {
    const cat = categorizeFrame(f)
    if (!cat) continue
    const browseItem: BrowseItemV2 = {
      uniqueName: f.uniqueName,
      name: f.name,
      slug: slugify(f.name),
      category: cat,
      imageName: imageByUniqueName.get(f.uniqueName),
      masteryReq: f.masteryReq,
      isPrime: f.isPrime,
      displayClass: frameDisplayClass(f),
    }
    push(cat, browseItem)
    stats.frames.emitted++
  }

  // Weapons — pre-compute the exalted set from frames' exalted[] arrays
  // so categorize picks up exalteds the wiki doesn't tag (Garuda Talons).
  const exaltedSet = buildExaltedSet(mergedFrames)
  const weaponDetailByCatAndSlug = new Map<string, MergedWeapon>()
  for (const w of mergedWeapons) {
    const cats = categorizeWeapon(w, exaltedSet)
    if (cats.length === 0) continue
    const slug = slugify(w.name)
    const browseItem: BrowseItemV2 = {
      uniqueName: w.uniqueName,
      name: w.name,
      slug,
      category: cats[0]!,
      imageName: imageByUniqueName.get(w.uniqueName),
      masteryReq: w.masteryReq,
      isPrime: w.name.includes(" Prime"),
      displayClass: w.displayClass ?? undefined,
    }
    for (const c of cats) {
      push(c, { ...browseItem, category: c })
      weaponDetailByCatAndSlug.set(`${c}|${slug}`, w)
    }
    stats.weapons.emitted++
  }

  // Companions
  for (const c of mergedCompanions) {
    const cat = categorizeCompanion(c)
    push(cat, {
      uniqueName: c.uniqueName,
      name: c.name,
      slug: slugify(c.name),
      category: cat,
      imageName: imageByUniqueName.get(c.uniqueName),
      masteryReq: c.masteryReq,
      isPrime: c.isPrime,
      displayClass: c.subType === "sentinel" ? "Sentinel" : "Beast Companion",
    })
  }

  // Synthetic Plexus
  push("railjack", {
    uniqueName: curated.plexusBrowse.uniqueName,
    name: curated.plexusBrowse.name,
    slug: curated.plexusBrowse.slug,
    category: "railjack",
    imageName: curated.plexusBrowse.imageName,
    isPrime: false,
    displayClass: "Plexus",
  })

  // Per-category counts
  for (const [cat, arr] of Object.entries(byCategory)) {
    stats.perCategory[cat] = arr?.length ?? 0
  }

  // ---------- 8. Write outputs ----------
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })

  const indexJson = JSON.stringify(byCategory)
  await writeFile(resolve(OUT_DIR, "items-index.json"), indexJson, "utf8")
  console.log(`\n  OK  items-index.json (${(indexJson.length / 1024).toFixed(1)} KB)`)

  await writeFile(
    resolve(OUT_DIR, "mods-all.json"),
    JSON.stringify(mergedMods),
    "utf8",
  )
  console.log(`  OK  mods-all.json (${mergedMods.length} mods)`)

  await writeFile(
    resolve(OUT_DIR, "arcanes-all.json"),
    JSON.stringify(arcanesWithImages),
    "utf8",
  )
  console.log(`  OK  arcanes-all.json (${arcanesWithImages.length} arcanes)`)

  // Helminth abilities — derived from merged frames + DE's separate
  // ExportAbilities array (which holds the Helminth-native ones).
  const helminth = deriveHelminthAbilities(
    mergedFrames,
    deFramesBlob.ExportAbilities ?? [],
  )
  await writeFile(
    resolve(OUT_DIR, "helminth-abilities.json"),
    JSON.stringify(helminth),
    "utf8",
  )
  console.log(`  OK  helminth-abilities.json (${helminth.length} abilities)`)

  // Per-item detail files — minimal pass-through for now. Phase 4b will
  // populate the rich damage/attacks shape; for now we emit the merged
  // weapon record verbatim so the schema is discoverable.
  await mkdir(DETAIL_DIR, { recursive: true })
  let detailCount = 0
  let detailBytes = 0
  function writeDetail(cat: string, slug: string, payload: unknown): Promise<void> {
    return mkdir(resolve(DETAIL_DIR, cat), { recursive: true }).then(async () => {
      const body = JSON.stringify(payload)
      await writeFile(resolve(DETAIL_DIR, cat, `${slug}.json`), body, "utf8")
      detailCount++
      detailBytes += Buffer.byteLength(body, "utf8")
    })
  }

  for (const [catSlug, w] of weaponDetailByCatAndSlug) {
    const [cat, slug] = catSlug.split("|")
    if (!cat || !slug) continue
    await writeDetail(cat, slug, {
      ...w,
      imageName: imageByUniqueName.get(w.uniqueName),
    })
  }
  for (const f of [...mergedFrames, ...operators]) {
    const cat = categorizeFrame(f)
    if (!cat) continue
    await writeDetail(cat, slugify(f.name), {
      ...f,
      imageName: imageByUniqueName.get(f.uniqueName),
      displayClass: frameDisplayClass(f),
    })
  }
  for (const c of mergedCompanions) {
    await writeDetail("companions", slugify(c.name), {
      ...c,
      imageName: imageByUniqueName.get(c.uniqueName),
    })
  }
  // Plexus
  await writeDetail("railjack", curated.plexusDetail.slug, curated.plexusDetail)
  console.log(
    `  OK  ${detailCount} per-item details (${(detailBytes / 1024 / 1024).toFixed(2)} MB total)`,
  )

  // Meta
  await writeFile(
    resolve(OUT_DIR, "meta.json"),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        source: "DE PublicExport + wiki Lua (v2 pipeline)",
        pipelineVersion: 2,
        itemCount: Object.values(stats.perCategory).reduce((a, b) => a + b, 0),
        modCount: mergedMods.length,
        unmatchedWeapons: stats.weapons.unmatched,
        unmatchedFrames: frameUnmatched.size,
      },
      null,
      2,
    ),
    "utf8",
  )

  // Report
  await writeFile(
    resolve(OUT_DIR, "_report.json"),
    JSON.stringify(
      {
        stats,
        weaponsUnmatched: [...weaponUnmatched].sort(),
        framesUnmatched: [...frameUnmatched].sort(),
        companionsUnmatched: unmatchedDeNames.sort(),
      },
      null,
      2,
    ),
    "utf8",
  )

  console.log("\nBy category:")
  for (const [cat, n] of Object.entries(stats.perCategory).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(20)} ${n}`)
  }
  console.log()
  console.log(`Weapons unmatched (no wiki record): ${stats.weapons.unmatched}`)
  console.log(`Frames unmatched (no wiki record):  ${frameUnmatched.size}`)
  console.log(`DE companions only (no wiki match): ${stats.companions.deOnly}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
