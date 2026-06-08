/**
 * Build the static catalog under `apps/web/public/data/` by merging
 * DE PublicExport + wiki Lua + curated overrides.
 *
 * Outputs:
 *   items-index.json            — flat per-category browse listing
 *   items/<cat>/<slug>.json     — per-item detail (weapons + frames +
 *                                 companions)
 *   mods-all.json               — all mods, post-normalization
 *   arcanes-all.json            — arcanes with image fill
 *   helminth-abilities.json     — Helminth subsume picker list
 *   image-map.json              — uniqueName → imageName for items/mods/
 *                                 arcanes/helminth (build image re-resolution)
 *   incarnon-evolutions.json    — evolution trees (curated passthrough)
 *   meta.json + _report.json    — build metadata + diagnostics
 *
 * Schema notes:
 *   - BrowseItem carries `displayClass` (the wiki Class label).
 *   - Per-item weapon detail carries `modPools`, `polarities`,
 *     `family`, `traits` from the wiki merge.
 *   - Polarities everywhere are lowercase full names ("naramon", not "V").
 *   - All items (weapons + frames + companions) carry `modPools` — the
 *     structural mod-routing field consumed by `getModsForItem`.
 *
 * Stable fields: uniqueName, name, slug, category, imageName, masteryReq,
 * isPrime, vaulted, releaseDate.
 */

import { readdirSync } from "node:fs"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import { INCARNON_EVOLUTIONS } from "@arsenyx/shared/warframe/incarnon-evolutions"
import {
  isKitgunChamber,
  KITGUN_GRIPS,
  KITGUN_LOADERS,
} from "@arsenyx/shared/warframe/kitgun-data"
import {
  ZAW_GRIPS,
  ZAW_LINKS,
  ZAW_STRIKES,
} from "@arsenyx/shared/warframe/zaw-data"

import { PVE_USABLE_CONCLAVE_MODS } from "../data/curated/pve-usable-conclave-mods"
import { buildBrowseIndex } from "./build/browse-index"
import { iterWikiRecords } from "./build/images"
import { mergeArcanes, type MergedArcane } from "./build/merge-arcanes"
import { buildModConflicts } from "./build/mod-conflicts"
import { resolveImages } from "./build/resolve-images"
import { writeItemDetails } from "./build/write-details"
import { mergeCompanions, type MergedCompanion } from "./build/merge-companions"
import {
  mergeFrame,
  operatorsFromWiki,
  type MergedFrame,
} from "./build/merge-frames"
import { deriveHelminthAbilities } from "./build/merge-helminth"
import { mergeMods, type MergedMod } from "./build/merge-mods"
import { mergeModular } from "./build/merge-modular"
import {
  mergeWeapon,
  mergeWikiOnlyWeapon,
  validateCuratedAgainstKnown,
  type MergedWeapon,
} from "./build/merge-weapons"
import { readCurated } from "./build/read-curated"
import {
  readDeArcanes,
  readDeFrames,
  readDeManifest,
  readDeSentinels,
  readDeUpgrades,
  readDeWeapons,
  type DeSentinel,
} from "./build/read-de"
import { readPePlusUpgrades, readPePlusWeaponTags } from "./build/read-pe-plus"
import { readWikiModule } from "./build/read-wiki"

const REPO_ROOT = resolve(import.meta.dirname, "..")
const WIKI_DIR = resolve(REPO_ROOT, "data/raw/wiki")
const OUT_DIR = resolve(REPO_ROOT, "apps/web/public/data")
const DETAIL_DIR = resolve(OUT_DIR, "items")
const WIKI_IMAGE_CACHE = resolve(REPO_ROOT, "data/curated/wiki-image-urls.json")

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
  console.log(
    `DE: ${deWeapons.length} weapons, ${deFramesBlob.ExportWarframes.length} frames, ${deSentinelsBlob.ExportSentinels.length} sentinel-blob rows, ${deUpgrades.ExportUpgrades?.length ?? 0} upgrades`,
  )

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
  console.log(
    `Wiki weapons (across subpages): ${wikiWeaponsByName.size} unique names`,
  )

  const wikiFramesBlob = readWikiModule(
    resolve(WIKI_DIR, "Warframes_data.lua"),
  ) as {
    Warframes?: Record<string, Record<string, unknown>>
    Archwings?: Record<string, Record<string, unknown>>
    Necramechs?: Record<string, Record<string, unknown>>
    Operators?: Record<string, Record<string, unknown>>
  }

  const wikiCompanionsBlob = readWikiModule(
    resolve(WIKI_DIR, "Companions_data.lua"),
  ) as { Companions?: Record<string, Record<string, unknown>> }
  const wikiCompanions = wikiCompanionsBlob.Companions ?? {}
  console.log(
    `Wiki: ${Object.keys(wikiFramesBlob.Warframes ?? {}).length} warframes, ${Object.keys(wikiCompanions).length} companions`,
  )

  // Mods + Arcane wiki modules — consumed by image resolution (phase 5) and
  // the mod/arcane merge (phase 6).
  const wikiModsBlob = readWikiModule(resolve(WIKI_DIR, "Mods_data.lua"))
  const wikiArcanesBlob = readWikiModule(resolve(WIKI_DIR, "Arcane_data.lua"))

  // Modular (Kitgun/Zaw) stat tables. Module:Modular/data is the only
  // verifiable source for the per-combination stats DE zeroes out; pass the
  // weapon entries so chamber damage can be allocated across attack modes.
  const modularData = mergeModular(
    readWikiModule(resolve(WIKI_DIR, "Modular_data.lua")),
    wikiWeaponsByName,
  )

  // ---------- 2. Merge weapons ----------
  // DE rows with `slot === undefined` are modular component parts (Kitgun
  // chambers/grips/loaders, Zaw strikes, MOA/Hound subparts, Amp parts,
  // Vulpaphyla/Predasite antigens, K-Drive parts). They share the
  // `productCategory: "Pistols"` bucket with real secondaries, but the wiki
  // doesn't index them as weapons — so skip them silently rather than dumping
  // 180 false positives into the unmatched report.
  const weaponUnmatched = new Set<string>()
  const skippedModular: string[] = []
  const mergedWeapons: MergedWeapon[] = []
  const seenWikiNames = new Set<string>()
  // DE's ExportWeapons occasionally ships the same uniqueName multiple
  // times (Mausolon has 3 identical entries; a few other arch-guns have 2).
  // Dedupe on first-seen so we don't emit duplicates downstream.
  const seenWeaponUniqueNames = new Set<string>()
  for (const de of deWeapons) {
    if (de.slot === undefined) {
      skippedModular.push(de.name)
      continue
    }
    if (seenWeaponUniqueNames.has(de.uniqueName)) continue
    seenWeaponUniqueNames.add(de.uniqueName)
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
    // Arch-gun atmospheric variants (Slot "Archgun (Atmosphere)") are
    // folded into the base weapon's atmospheric* fields by `mergeWeapon`.
    // Skip emitting them as standalone browse items.
    if (w.Slot === "Archgun (Atmosphere)") continue
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
    mergedFrames.push(
      mergeFrame(de, { wiki: wikiFramesBlob, unmatched: frameUnmatched }),
    )
  }
  const operators = operatorsFromWiki(wikiFramesBlob)
  stats.frames.de = deFramesBlob.ExportWarframes.length
  stats.frames.merged = mergedFrames.length
  stats.frames.operators = operators.length

  // ---------- 4. Merge companions ----------
  const deCompanionByName = new Map<string, DeSentinel>()
  for (const ent of deSentinelsBlob.ExportSentinels) {
    if (
      ent.productCategory === "Sentinels" ||
      ent.productCategory === "KubrowPets"
    ) {
      deCompanionByName.set(ent.name, ent)
    }
  }
  const { companions: mergedCompanions, unmatchedDeNames } = mergeCompanions({
    wikiCompanions,
    deByName: deCompanionByName,
  })
  stats.companions.wiki = mergedCompanions.length
  stats.companions.deOnly = unmatchedDeNames.length

  // ---------- 5. Image lookup ----------
  const {
    imageByUniqueName,
    arcaneArtUrlByUniqueName,
    arcaneSlotByUniqueName,
    wikiArcaneNames,
  } = await resolveImages({
    deManifest,
    wikiFramesBlob,
    wikiCompanionsBlob,
    wikiWeaponsByName,
    wikiModsBlob,
    wikiArcanesBlob,
    exaltedStances: curated.exaltedStances,
    cachePath: WIKI_IMAGE_CACHE,
  })

  // ---------- 6. Merge mods + arcanes ----------
  // OpenWF's `warframe-public-export-plus` provides the `compat` routing
  // field extracted from the game client. We use it to lock augments to
  // their specific weapon — strictly more reliable than the wiki-Class-based
  // modPools inference, which periodically drifted.
  const pePlusUpgrades = readPePlusUpgrades()
  // Weapon intrinsic tags (GRNBOW, SEMI_AUTO, PROJECTILE, …) — refined
  // against mod compat/incompat tags by getModsForItem. Attached to weapon
  // detail items below.
  const pePlusWeaponTags = readPePlusWeaponTags()
  const wikiExilus = new Map<string, boolean>()
  // Wiki convention: `_IgnoreEntry = true` flags records the wiki maintainers
  // consider unreleased / non-functional (e.g. "Primed Streamline" — exists
  // in DE ExportUpgrades but isn't a real in-game mod). We honor it.
  const wikiIgnoreMods = new Set<string>()
  // Names of every wiki-registered mod. Used by merge-mods to gate the
  // Primed-Expert allowance against DE's stream of unreleased Primed mods.
  const wikiKnownModNames = new Set<string>()
  // Wiki PvP flag — `Conclave = true` is the canonical Conclave marker
  // (155 mods). The description "in Conclave" substring covers only ~14%
  // of them, so we route via this instead.
  const wikiConclaveMods = new Set<string>()
  // PVE_USABLE_CONCLAVE_MODS entries we actually saw as Conclave-flagged
  // records. Used to warn on drift: an entry that never matches (typo, or a
  // wiki InternalName rename) silently stops excluding its mod and the mod
  // vanishes from the PvE picker again — surface that at build time.
  const pveUsableSeen = new Set<string>()
  // Mod display Name → wiki InternalName (= DE uniqueName). Resolves the
  // name-keyed `Incompatible` lists into uniqueNames below.
  const wikiModUniqueNameByName = new Map<string, string>()
  // Owning mod display Name → its `Incompatible` list (display Names). Mutually
  // exclusive variant mods (Serration / Amalgam Serration / Spectral
  // Serration, …) — see the conflict-graph build after mod merge. Keyed by
  // display Name (not InternalName) because the wiki's InternalName drifts from
  // DE's uniqueName for some recent Primed mods, which silently dropped the
  // edge; resolving both endpoints by display Name against the emitted catalog
  // is robust to that drift.
  const wikiIncompatByName = new Map<string, string[]>()
  for (const { internalName, record } of iterWikiRecords(wikiModsBlob)) {
    const name = record["Name"]
    if (typeof name === "string") {
      wikiKnownModNames.add(name)
      wikiModUniqueNameByName.set(name, internalName)
    }
    if (typeof record["IsExilus"] === "boolean") {
      wikiExilus.set(internalName, record["IsExilus"])
    }
    if (record["_IgnoreEntry"] === true) {
      wikiIgnoreMods.add(internalName)
    }
    // `Conclave = true` means "usable in Conclave", not "PvP-exclusive". A
    // handful of ability augments + zoom mods are usable in PvE too (and one,
    // Vexing Retaliation, is mis-flagged outright) — keep those out of the PvP
    // set so the picker's PvE view shows them. See pve-usable-conclave-mods.ts.
    if (record["Conclave"] === true) {
      if (PVE_USABLE_CONCLAVE_MODS.has(internalName)) {
        pveUsableSeen.add(internalName)
      } else {
        wikiConclaveMods.add(internalName)
      }
    }
    const incompat = record["Incompatible"]
    if (Array.isArray(incompat) && typeof name === "string") {
      // Some wiki entries carry placeholder `""` names; drop them so they
      // never become a dead lookup key.
      wikiIncompatByName.set(
        name,
        incompat.filter((x): x is string => typeof x === "string" && x !== ""),
      )
    }
  }
  const unmatchedPveUsable = [...PVE_USABLE_CONCLAVE_MODS].filter(
    (name) => !pveUsableSeen.has(name),
  )
  if (unmatchedPveUsable.length > 0) {
    console.warn(
      `  WARN pve-usable-conclave-mods.ts: ${unmatchedPveUsable.length} allowlist entr${
        unmatchedPveUsable.length === 1 ? "y" : "ies"
      } matched no Conclave-flagged wiki record (typo or wiki rename — these mods are no longer being un-hidden from the PvE picker):\n${unmatchedPveUsable
        .map((n) => `         - ${n}`)
        .join("\n")}`,
    )
  }

  const { mods: rawMergedMods, counts: modCounts } = mergeMods(
    deUpgrades.ExportUpgrades ?? [],
    deUpgrades.ExportModSet ?? [],
    pePlusUpgrades,
    wikiExilus,
    deUpgrades.ExportAvionics ?? [],
    wikiIgnoreMods,
    wikiKnownModNames,
    wikiConclaveMods,
  )
  let mergedMods = rawMergedMods.map((m) => ({
    ...m,
    imageName: imageByUniqueName.get(m.uniqueName),
  }))
  stats.mods.de = modCounts.total
  stats.mods.kept = modCounts.kept

  const deArcanes = readDeArcanes()
  const allMergedArcanes = mergeArcanes(deArcanes.ExportRelicArcane ?? [])
  // DE ships per-ability-slot copies of some arcanes (Arcane Steadfast has
  // 5 records — one per ability + on-cast) and a handful of cut entries
  // (e.g. "Arcane Liquid") that aren't in-game. `wikiArcaneNames` (built in
  // the single arcane-module walk above) is the canonical in-game list;
  // intersect against it to drop both.
  const mergedArcanes = allMergedArcanes.filter((a) =>
    wikiArcaneNames.has(a.uniqueName),
  )
  const arcanesWithImages = mergedArcanes.map((a) => ({
    ...a,
    // Prefer the wiki full-art frame over DE's symbol-only Projection; fall
    // back to the generic lookup for arcanes the wiki doesn't list.
    imageName:
      arcaneArtUrlByUniqueName.get(a.uniqueName) ??
      imageByUniqueName.get(a.uniqueName),
    slotType: arcaneSlotByUniqueName.get(a.uniqueName),
  }))

  // ---------- 7. Build items-index.json ----------
  const { byCategory, weaponDetailByCatAndSlug, releaseHistoryResolved } =
    buildBrowseIndex({
      mergedFrames,
      operators,
      mergedWeapons,
      mergedCompanions,
      curated,
      imageByUniqueName,
      stats,
    })

  // ---------- 8. Expand mod `compat` to per-item lists ----------
  // OpenWF's `compat` is one of three things:
  //
  //   1. A specific item uniqueName (e.g. weapon augments) — direct match.
  //   2. A frame "BaseSuit" anchor like `/Lotus/Powersuits/Excalibur/
  //      ExcaliburBaseSuit`. DE's `parentName` chain doesn't fully resolve
  //      (intermediate suits like `DarkExcalibur` aren't first-class
  //      records), so we use a path-prefix heuristic: BaseSuit compat
  //      expands to every catalog frame in the same `/Lotus/Powersuits/
  //      <Family>/` directory. This covers Excalibur ↔ ExcaliburPrime ↔
  //      ExcaliburUmbra without depending on DE shipping the full chain.
  //   3. A generic class anchor (e.g. `.../PlayerMeleeWeapon`) — strip,
  //      `modPools` already covers the equivalent routing.
  //
  // Output field is `compatItems: string[]` — a closed list of item
  // uniqueNames the augment fits. Runtime check collapses to a single
  // `includes(item.uniqueName)`.
  const knownItemUniqueNames = new Set<string>()
  /** Track each item's category so BaseSuit expansion can stay within
   *  warframes (Excalibur's directory also contains the Exalted Blade
   *  exalted weapon — without a category gate the path-prefix heuristic
   *  would pull the exalted weapon in as a "frame variant"). */
  const categoryByUniqueName = new Map<string, string>()
  for (const [cat, arr] of Object.entries(byCategory)) {
    if (!arr) continue
    for (const item of arr) {
      knownItemUniqueNames.add(item.uniqueName)
      categoryByUniqueName.set(item.uniqueName, cat)
    }
  }

  // BaseSuit/BaseMechSuit → all frames in the same family directory. The
  // path prefix alone over-matches (exalted weapons share the directory),
  // so each anchor also requires a matching item category.
  const BASE_SUIT_ANCHORS = [
    { token: "BaseSuit", cat: "warframes" },
    { token: "BaseMechSuit", cat: "necramechs" },
  ] as const

  function expandCompat(compat: string): string[] {
    if (knownItemUniqueNames.has(compat)) return [compat]
    for (const { token, cat } of BASE_SUIT_ANCHORS) {
      if (!compat.includes(token)) continue
      const dir = compat.slice(0, compat.lastIndexOf("/") + 1)
      const out: string[] = []
      for (const un of knownItemUniqueNames) {
        if (un.startsWith(dir) && categoryByUniqueName.get(un) === cat) {
          out.push(un)
        }
      }
      return out
    }
    return []
  }

  let augmentCount = 0
  let strippedCount = 0
  mergedMods = mergedMods.map((m) => {
    if (!m.compat) return m
    const expanded = expandCompat(m.compat)
    const { compat: _drop, ...rest } = m
    if (expanded.length > 0) {
      augmentCount++
      return { ...rest, compatItems: expanded }
    }
    strippedCount++
    return rest
  })
  console.log(
    `\n  compat: ${augmentCount} augment-style (kept), ${strippedCount} unresolved (stripped)`,
  )

  // ---------- 8b. Mod conflict graph ----------
  const modConflicts = buildModConflicts(
    mergedMods,
    wikiIncompatByName,
    wikiModUniqueNameByName,
  )

  // ---------- 9. Write outputs ----------
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })

  const indexJson = JSON.stringify(byCategory)
  await writeFile(resolve(OUT_DIR, "items-index.json"), indexJson, "utf8")
  console.log(
    `\n  OK  items-index.json (${(indexJson.length / 1024).toFixed(1)} KB)`,
  )

  await writeFile(
    resolve(OUT_DIR, "mods-all.json"),
    JSON.stringify(mergedMods),
    "utf8",
  )
  console.log(`  OK  mods-all.json (${mergedMods.length} mods)`)

  await writeFile(
    resolve(OUT_DIR, "mod-conflicts.json"),
    JSON.stringify(modConflicts),
    "utf8",
  )
  console.log(
    `  OK  mod-conflicts.json (${Object.keys(modConflicts).length} mods)`,
  )

  await writeFile(
    resolve(OUT_DIR, "arcanes-all.json"),
    JSON.stringify(arcanesWithImages),
    "utf8",
  )
  console.log(`  OK  arcanes-all.json (${arcanesWithImages.length} arcanes)`)

  // Helminth abilities — derived from merged frames + DE's separate
  // ExportAbilities array (which holds the Helminth-native ones). DE
  // doesn't populate `imageName` inline, so fill it from the central
  // image lookup keyed on each ability's uniqueName.
  const helminthRaw = deriveHelminthAbilities(
    mergedFrames,
    deFramesBlob.ExportAbilities ?? [],
  )
  const helminth = helminthRaw.map((a) => ({
    ...a,
    imageName: imageByUniqueName.get(a.uniqueName) ?? a.imageName,
  }))
  await writeFile(
    resolve(OUT_DIR, "helminth-abilities.json"),
    JSON.stringify(helminth),
    "utf8",
  )
  console.log(`  OK  helminth-abilities.json (${helminth.length} abilities)`)

  // Image map: uniqueName → current imageName for every entity a saved build
  // can reference (items, mods, arcanes, helminth abilities). Builds persist a
  // denormalized imageName at save time which rots whenever the image-naming/
  // hosting scheme changes; the viewer + build lists re-resolve against this
  // map by the stable uniqueName. Kept separate from the full catalogs so a
  // build page can refresh every image without downloading mods-all.json
  // (~1.2 MB). sync:images rewrites these URLs to our CDN like any other file.
  const imageMap: Record<string, string> = {}
  const addImage = (uniqueName?: string, imageName?: string) => {
    if (uniqueName && imageName && !(uniqueName in imageMap)) {
      imageMap[uniqueName] = imageName
    }
  }
  for (const list of Object.values(byCategory)) {
    for (const it of list) addImage(it.uniqueName, it.imageName)
  }
  for (const m of mergedMods) addImage(m.uniqueName, m.imageName)
  for (const a of arcanesWithImages) addImage(a.uniqueName, a.imageName)
  for (const h of helminth) addImage(h.uniqueName, h.imageName)
  const imageMapBody = JSON.stringify(imageMap)
  await writeFile(resolve(OUT_DIR, "image-map.json"), imageMapBody, "utf8")
  console.log(
    `  OK  image-map.json (${Object.keys(imageMap).length} entries, ${(imageMapBody.length / 1024).toFixed(1)} KB)`,
  )

  // Incarnon evolution trees — verbatim passthrough from the curated
  // shared module (lazy-fetched by the editor sidebar).
  const incarnonBody = JSON.stringify(INCARNON_EVOLUTIONS)
  await writeFile(
    resolve(OUT_DIR, "incarnon-evolutions.json"),
    incarnonBody,
    "utf8",
  )
  console.log(
    `  OK  incarnon-evolutions.json (${Object.keys(INCARNON_EVOLUTIONS).length} weapons, ${(incarnonBody.length / 1024).toFixed(1)} KB)`,
  )

  // Modular (Kitgun/Zaw) stat reconstruction tables — fetched by the build
  // editor to recompute a chamber's stats from the selected grip + loader.
  const modularBody = JSON.stringify(modularData)
  await writeFile(resolve(OUT_DIR, "modular.json"), modularBody, "utf8")
  const kitgunChambers =
    Object.keys(modularData.kitgun.primary).length +
    Object.keys(modularData.kitgun.secondary).length
  console.log(
    `  OK  modular.json (${kitgunChambers} kitgun chambers, ${Object.keys(modularData.kitgun.loaders).length} loaders, ${Object.keys(modularData.zaw.strikes).length} zaw strikes, ${(modularBody.length / 1024).toFixed(1)} KB)`,
  )

  // Guard the runtime stat-reconstruction coupling: a kitgun chamber's stats
  // resolve via `item.family` → modular.json[class][family]. `family` (wiki
  // `Family`), the Module:Modular/data Chamber key, and the catalog name must
  // agree, or `adjustChamberForKitgun` silently falls back to the zero-stat
  // shell — the exact bug this data fixes, reintroduced invisibly. Warn at
  // build time if any kitgun chamber browse item has no usable modular entry.
  for (const w of mergedWeapons) {
    if (!isKitgunChamber(w.uniqueName)) continue
    const cls = w.slot === "Primary" ? "primary" : "secondary"
    const chamber = w.family ? modularData.kitgun[cls][w.family] : undefined
    if (!chamber || Object.keys(chamber.grips).length === 0) {
      console.warn(
        `  WARN kitgun chamber "${w.name}" (family=${w.family ?? "?"}, ${cls}) has no usable Module:Modular/data entry — its stats won't reconstruct`,
      )
    }
  }

  // Zaw component picker thumbnails. Grips/links/strikes aren't catalog items,
  // so resolve their DE CDN URLs (with version hash) from the manifest by
  // matching each component's texture filename, keyed by component name for
  // the web picker. Their old wiki `Special:FilePath` URLs 404 on the current
  // wiki; these flow through sync:images → R2 like every other catalog image.
  const zawByFile = new Map<string, string>()
  for (const url of imageByUniqueName.values()) {
    if (!url.includes("/Zaws/")) continue
    const file = url.split("/").pop()?.split("!")[0]
    if (file && !zawByFile.has(file)) zawByFile.set(file, url)
  }
  const zawImages: Record<string, string> = {}
  for (const c of [...ZAW_STRIKES, ...ZAW_GRIPS, ...ZAW_LINKS]) {
    const url = zawByFile.get(c.imageName)
    if (url) zawImages[c.name] = url
  }
  const zawTotal = ZAW_STRIKES.length + ZAW_GRIPS.length + ZAW_LINKS.length
  await writeFile(
    resolve(OUT_DIR, "zaw-images.json"),
    JSON.stringify(zawImages),
    "utf8",
  )
  if (Object.keys(zawImages).length < zawTotal) {
    console.warn(
      `  WARN zaw-images.json resolved ${Object.keys(zawImages).length}/${zawTotal} — some component textures missing from the manifest`,
    )
  } else {
    console.log(`  OK  zaw-images.json (${zawTotal} components)`)
  }

  // Kitgun grip/loader picker thumbnails. Each part carries its DE
  // uniqueName, so resolve the manifest CDN URL directly (no filename match
  // needed), keyed by component name for the web picker. Flows through
  // sync:images → R2 like every other catalog image.
  const kitgunImages: Record<string, string> = {}
  for (const c of [...KITGUN_GRIPS, ...KITGUN_LOADERS]) {
    const url = imageByUniqueName.get(c.uniqueName)
    if (url) kitgunImages[c.name] = url
  }
  const kitgunTotal = KITGUN_GRIPS.length + KITGUN_LOADERS.length
  await writeFile(
    resolve(OUT_DIR, "kitgun-images.json"),
    JSON.stringify(kitgunImages),
    "utf8",
  )
  if (Object.keys(kitgunImages).length < kitgunTotal) {
    console.warn(
      `  WARN kitgun-images.json resolved ${Object.keys(kitgunImages).length}/${kitgunTotal} — some component textures missing from the manifest`,
    )
  } else {
    console.log(`  OK  kitgun-images.json (${kitgunTotal} components)`)
  }

  // Per-item detail files (items/<cat>/<slug>.json).
  await writeItemDetails({
    detailDir: DETAIL_DIR,
    weaponDetailByCatAndSlug,
    mergedFrames,
    operators,
    mergedCompanions,
    curated,
    imageByUniqueName,
    pePlusWeaponTags,
  })

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
        skippedModularComponents: skippedModular.sort(),
        releaseHistoryUnmatched: Object.keys(curated.releaseHistory)
          .filter((n) => !releaseHistoryResolved.has(n))
          .sort(),
      },
      null,
      2,
    ),
    "utf8",
  )

  console.log("\nBy category:")
  for (const [cat, n] of Object.entries(stats.perCategory).sort(
    (a, b) => b[1] - a[1],
  )) {
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
