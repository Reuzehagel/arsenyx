/**
 * Build the static catalog under `apps/web/public/data/` by merging
 * DE PublicExport + wiki Lua + curated overrides.
 *
 * Main outputs: items-index.json (per-category browse listing),
 * items/<cat>/<slug>.json (per-item detail), mods-all.json, arcanes-all.json,
 * helminth-abilities.json, image-map.json, plus small lookup files, meta.json
 * (cache-bust version + counts, see build/meta.ts) and _report.json
 * (diagnostics the weekly refresh PR diffs).
 *
 * Every emitted file name is in CATALOG_FILES
 * (packages/shared/src/warframe/catalog-files.ts).
 */

import { spawnSync } from "node:child_process"
import { mkdir, rm, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import type { HelminthAbility } from "@arsenyx/shared/warframe/build-data"
import {
  CATALOG_FILES,
  ITEM_DETAIL_DIR,
} from "@arsenyx/shared/warframe/catalog-files"
import { INCARNON_GENESIS_IMAGES } from "@arsenyx/shared/warframe/incarnon-data"
import { INCARNON_EVOLUTIONS } from "@arsenyx/shared/warframe/incarnon-evolutions"
import {
  isKitgunChamber,
  KITGUN_GRIPS,
  KITGUN_LOADERS,
} from "@arsenyx/shared/warframe/kitgun-data"
import { isPlexusMod } from "@arsenyx/shared/warframe/mods"
import type { Arcane, Mod } from "@arsenyx/shared/warframe/types"
import {
  ZAW_GRIPS,
  ZAW_LINKS,
  ZAW_STRIKES,
} from "@arsenyx/shared/warframe/zaw-data"

import { ARCANE_KEEP, ARCANE_SLOT_FALLBACKS } from "../data/curated/arcane-keep"
import { DE_MISSING_ARCANES } from "../data/curated/de-missing-arcanes"
import { DE_MISSING_MODS } from "../data/curated/de-missing-mods"
import { EXALTED_STANCES } from "../data/curated/exalted-stances"
import { FRAME_POLARITY_OVERRIDES } from "../data/curated/frame-polarities"
import { OPERATOR_IMAGE_FIXES } from "../data/curated/operator-images"
import { RELEASE_HISTORY } from "../data/curated/release-history"
import { WIKI_ALIASES } from "../data/curated/wiki-aliases"
import { buildBrowseIndex } from "./build/browse-index"
import { injectMissingDeMods } from "./build/de-missing-mods"
import type { DeSentinel } from "./build/de-types"
import { buildFamilyIndex, makeExpandCompat } from "./build/expand-compat"
import {
  abilityStatsLookup,
  type AbilityRef,
} from "./build/merge-ability-stats"
import { mergeArcanes } from "./build/merge-arcanes"
import { mergeCompanions } from "./build/merge-companions"
import {
  collapseTwinFrames,
  mergeFrame,
  operatorsFromWiki,
  rankUpDrift,
  type MergedFrame,
} from "./build/merge-frames"
import { deriveHelminthAbilities } from "./build/merge-helminth"
import { mergeMods } from "./build/merge-mods"
import { mergeModular } from "./build/merge-modular"
import {
  mergeWeapon,
  mergeWikiOnlyWeapon,
  validateCuratedPools,
  type MergedWeapon,
} from "./build/merge-weapons"
import { countsFromCatalog, writeMeta } from "./build/meta"
import { buildModConflicts } from "./build/mod-conflicts"
import { ATMOSPHERE_SLOT, primeFamily } from "./build/names"
import {
  CATALOG_DIR,
  CATALOG_OUT_DIR as OUT_DIR,
  REPO_ROOT,
  WIKI_IMAGE_CACHE,
} from "./build/paths"
import {
  readDeArcanes,
  readDeFrames,
  readDeManifest,
  readDeSentinels,
  readDeUpgrades,
  readDeWeapons,
} from "./build/read-de"
import { readPePlusUpgrades, readPePlusWeaponTags } from "./build/read-pe-plus"
import { readWiki, readWikiWeaponSubpages } from "./build/read-wiki"
import { resolveImages } from "./build/resolve-images"
import { validateOutputs } from "./build/validate-output"
import { readWikiModFlags } from "./build/wiki-mod-flags"
import { writeItemDetails } from "./build/write-details"

const DETAIL_DIR = resolve(OUT_DIR, ITEM_DETAIL_DIR)

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

/** Texture filename (sans DE `!00_<hash>`) → first image URL under `dir`. */
function imageUrlByFile(
  imageByUniqueName: Map<string, string>,
  dir: string,
): Map<string, string> {
  const out = new Map<string, string>()
  for (const url of imageByUniqueName.values()) {
    if (!url.includes(dir)) continue
    const file = url.split("/").pop()?.split("!")[0]
    if (file && !out.has(file)) out.set(file, url)
  }
  return out
}

async function main() {
  console.log(`Output dir: ${OUT_DIR}\n`)

  // ---------- 1. Read everything from disk ----------
  validateCuratedPools()

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
  for (const m of readWikiWeaponSubpages()) {
    for (const [n, e] of Object.entries(m)) {
      if (e && typeof e === "object") {
        wikiWeaponsByName.set(n, e as Record<string, unknown>)
      }
    }
  }
  console.log(
    `Wiki weapons (across subpages): ${wikiWeaponsByName.size} unique names`,
  )

  const wikiFramesBlob = readWiki("Warframes/data") as {
    Warframes?: Record<string, Record<string, unknown>>
    Archwings?: Record<string, Record<string, unknown>>
    Necramechs?: Record<string, Record<string, unknown>>
    Operators?: Record<string, Record<string, unknown>>
  }

  const wikiCompanionsBlob = readWiki("Companions/data") as {
    Companions?: Record<string, Record<string, unknown>>
  }
  const wikiCompanions = wikiCompanionsBlob.Companions ?? {}
  console.log(
    `Wiki: ${Object.keys(wikiFramesBlob.Warframes ?? {}).length} warframes, ${Object.keys(wikiCompanions).length} companions`,
  )

  // Mods + Arcane wiki modules — consumed by image resolution (phase 5) and
  // the mod/arcane merge (phase 6).
  const wikiModsBlob = readWiki("Mods/data")
  const wikiArcanesBlob = readWiki("Arcane/data")

  // Modular (Kitgun/Zaw) stat tables. Module:Modular/data is the only
  // verifiable source for the per-combination stats DE zeroes out; pass the
  // weapon entries so chamber damage can be allocated across attack modes.
  const modularData = mergeModular(readWiki("Modular/data"), wikiWeaponsByName)

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
      wikiByName: wikiWeaponsByName,
      unmatched: weaponUnmatched,
    })
    mergedWeapons.push(merged)
    // Track which wiki names we paired with a DE row (the merge step
    // strips `<ARCHWING> ` prefixes, so `merged.name` is the wiki key).
    seenWikiNames.add(merged.name)
    // Aliases also count as matched.
    const alias = WIKI_ALIASES[merged.name]
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
    // Arch-gun atmospheric variants are folded into the base weapon's
    // atmospheric* fields by `mergeWeapon`, not emitted standalone.
    if (w.Slot === ATMOSPHERE_SLOT) continue
    mergedWeapons.push(mergeWikiOnlyWeapon(name, wiki))
    wikiOnlyEmitted++
  }
  console.log(`Wiki-only weapons emitted: ${wikiOnlyEmitted}`)
  stats.weapons.de = deWeapons.length
  stats.weapons.merged = mergedWeapons.length
  stats.weapons.unmatched = weaponUnmatched.size

  // ---------- 3. Merge frames ----------
  const frameUnmatched = new Set<string>()
  const rawFrames: MergedFrame[] = []
  for (const de of deFramesBlob.ExportWarframes) {
    rawFrames.push(
      mergeFrame(de, {
        wiki: wikiFramesBlob,
        unmatched: frameUnmatched,
        polarityOverrides: FRAME_POLARITY_OVERRIDES,
      }),
    )
  }
  // Collapse twin-frames (e.g. Sirius & Orion ships as two DE rows) into one
  // entity carrying both forms, before any downstream consumer sees the list.
  const twinCollapsed = collapseTwinFrames(rawFrames)
  // Per-ability stats from Module:Ability/data/stats (max-rank values).
  const abilityStatsUnhandled: string[] = []
  const abilityStats = abilityStatsLookup(
    readWiki("Ability/data/stats"),
    twinCollapsed.flatMap((f) => [
      ...f.abilities,
      ...(f.forms ?? []).flatMap((form) => form.abilities),
    ]),
    abilityStatsUnhandled,
  )
  const withAbilityStats = <T extends AbilityRef>(a: T): T => {
    const s = abilityStats(a)
    return s ? { ...a, stats: s } : a
  }
  const mergedFrames = twinCollapsed.map((f) => ({
    ...f,
    abilities: f.abilities.map(withAbilityStats),
    ...(f.forms && {
      forms: f.forms.map((form) => ({
        ...form,
        abilities: form.abilities.map(withAbilityStats),
      })),
    }),
  }))
  const framesAbilities = mergedFrames
    .filter((f) => f.category === "warframes")
    .flatMap((f) => f.abilities)
  console.log(
    `Ability stats: ${framesAbilities.filter((a) => a.stats).length}/${framesAbilities.length} warframe abilities matched`,
  )
  const operators = operatorsFromWiki(wikiFramesBlob)
  // Recorded in _report.json too, so it shows up in the weekly refresh PR's diff.
  const frameRankUpDrift = rankUpDrift(mergedFrames, wikiFramesBlob)
  for (const line of frameRankUpDrift) {
    console.warn(
      `  WARN ${line} — add or fix the frame in packages/shared/src/warframe/rankup.ts (or list it in RANKUP_WIKI_DISPUTED if the wiki is wrong)`,
    )
  }
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
  const {
    companions: mergedCompanions,
    unmatchedDeNames,
    unknownTypes: companionsUnknownType,
  } = mergeCompanions({
    wikiCompanions,
    deByName: deCompanionByName,
  })
  stats.companions.wiki = mergedCompanions.length
  stats.companions.deOnly = unmatchedDeNames.length
  for (const c of companionsUnknownType) {
    console.warn(
      `  WARN companion ${c}: unknown wiki Type, routed as a beast — add it to subTypeOf in merge-companions.ts`,
    )
  }

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
    exaltedStances: EXALTED_STANCES,
    operatorWikiImages: new Map(
      operators.flatMap((o) => {
        const image =
          OPERATOR_IMAGE_FIXES[o.name] ??
          wikiFramesBlob.Operators?.[o.name]?.["Image"]
        return typeof image === "string" && image.length > 0
          ? [[o.uniqueName, image] as const]
          : []
      }),
    ),
    cachePath: WIKI_IMAGE_CACHE,
    refresh: process.argv.includes("--refresh-wiki-images"),
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
  // Backfill mods DE's export dropped but that are still in-game (#377).
  const missing = injectMissingDeMods(
    deUpgrades.ExportUpgrades ?? [],
    DE_MISSING_MODS,
  )
  if (missing.injected.length > 0) {
    console.log(
      `  de-missing-mods.ts: injected ${missing.injected.length} mod(s) DE no longer exports: ${missing.injected.join(", ")}`,
    )
  }
  if (missing.resurfaced.length > 0) {
    console.warn(
      `  WARN de-missing-mods.ts: DE ships these again — delete the curated entries: ${missing.resurfaced.join(", ")}`,
    )
  }

  // Every wiki-sourced flag, resolved onto DE uniqueNames through one
  // InternalName-else-unique-Name mapping (see wiki-mod-flags.ts).
  const wikiMods = readWikiModFlags(wikiModsBlob, missing.upgrades)
  if (wikiMods.unmatchedPveUsable.length > 0) {
    console.warn(
      `  WARN pve-usable-conclave-mods.ts: ${wikiMods.unmatchedPveUsable.length} allowlist entr${
        wikiMods.unmatchedPveUsable.length === 1 ? "y" : "ies"
      } matched no Conclave-flagged wiki record (typo or wiki rename — these mods are no longer being un-hidden from the PvE picker):\n${wikiMods.unmatchedPveUsable
        .map((n) => `         - ${n}`)
        .join("\n")}`,
    )
  }
  if (wikiMods.nameFallbacks.length > 0) {
    console.log(
      `  wiki mods: matched ${wikiMods.nameFallbacks.length} mod(s) by Name (InternalName drift): ${wikiMods.nameFallbacks.join(", ")}`,
    )
  }

  const { mods: rawMergedMods, counts: modCounts } = mergeMods({
    upgrades: missing.upgrades,
    modSets: deUpgrades.ExportModSet,
    avionics: deUpgrades.ExportAvionics,
    pePlus: pePlusUpgrades,
    wiki: wikiMods,
  })
  let mergedMods = rawMergedMods.map((m) => ({
    ...m,
    imageName: imageByUniqueName.get(m.uniqueName),
  }))
  stats.mods.de = modCounts.total
  stats.mods.kept = modCounts.kept

  const deArcanes = readDeArcanes()
  // Backfill the Tektolyst Artifact arcanes DE's export never shipped.
  const missingArcanes = injectMissingDeMods(
    deArcanes.ExportRelicArcane ?? [],
    DE_MISSING_ARCANES,
  )
  if (missingArcanes.resurfaced.length > 0) {
    console.warn(
      `  WARN de-missing-arcanes.ts: DE ships these again — delete the curated entries: ${missingArcanes.resurfaced.join(", ")}`,
    )
  }
  const allMergedArcanes = mergeArcanes(missingArcanes.upgrades)
  // DE ships per-ability-slot copies of some arcanes (Arcane Steadfast has
  // 5 records — one per ability + on-cast) and a handful of cut entries
  // (e.g. "Arcane Liquid") that aren't in-game. `wikiArcaneNames` (built in
  // the single arcane-module walk above) is the canonical in-game list;
  // intersect against it to drop both. `ARCANE_KEEP` rescues verified real
  // arcanes the wiki module has momentarily dropped (see arcane-keep.ts), so a
  // wiki hiccup can't silently delete obtainable content.
  const mergedArcanes = allMergedArcanes.filter(
    (a) => wikiArcaneNames.has(a.uniqueName) || ARCANE_KEEP.has(a.uniqueName),
  )
  const arcanesWithImages = mergedArcanes.map((a) => ({
    ...a,
    // Prefer the wiki full-art frame over DE's symbol-only Projection; fall
    // back to the generic lookup for arcanes the wiki doesn't list.
    imageName:
      arcaneArtUrlByUniqueName.get(a.uniqueName) ??
      imageByUniqueName.get(a.uniqueName),
    // Wiki `Type` is authoritative; the curated fallback covers rows that
    // are present but missing `Type` (see ARCANE_SLOT_FALLBACKS — an
    // un-routable arcane vanishes from every slot picker, #284).
    slotType:
      arcaneSlotByUniqueName.get(a.uniqueName) ??
      ARCANE_SLOT_FALLBACKS[a.uniqueName],
  }))

  // ---------- 7. Build items-index.json ----------
  const { byCategory, details, releaseHistoryResolved } = buildBrowseIndex({
    mergedFrames,
    operators,
    mergedWeapons,
    mergedCompanions,
    imageByUniqueName,
    stats,
  })

  // ---------- 8. Expand mod `compat` to per-item lists ----------
  // See scripts/build/expand-compat.ts for the three-case routing. Output
  // field is `compatItems: string[]` — the closed list of item uniqueNames the
  // augment fits; the runtime check collapses to `includes(item.uniqueName)`.
  const categoryByUniqueName = new Map<string, string>()
  for (const [cat, arr] of Object.entries(byCategory)) {
    for (const item of arr ?? []) categoryByUniqueName.set(item.uniqueName, cat)
  }

  // `family` lives on the merged records — the lightweight `byCategory` browse
  // projection drops it — so build the variant-family index from
  // mergedWeapons/Companions, gated to real catalog items by category.
  // Archwing frames join by name (Odonata ↔ Odonata Prime): their compat is a
  // direct item hit, not a BaseSuit anchor. Warframes stay on the anchor path.
  const archwingFrames = mergedFrames
    .filter((f) => f.category === "archwing")
    .map((f) => ({ uniqueName: f.uniqueName, family: primeFamily(f.name) }))
  const { familyKeyByUniqueName, familyMembers } = buildFamilyIndex(
    [...mergedWeapons, ...mergedCompanions, ...archwingFrames],
    categoryByUniqueName,
  )
  const expandCompat = makeExpandCompat({
    categoryByUniqueName,
    familyKeyByUniqueName,
    familyMembers,
  })

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
  const modConflicts = buildModConflicts(mergedMods, wikiMods)

  // ---------- 8c. Validate before touching the output dir ----------
  // Shape-check every emitted record and compare counts against the previous
  // build's meta.json (see validate-output.ts). Throws before the rm below,
  // so a broken merge can't replace a good catalog with a hollowed-out one.
  // A crash mid-write (rm below) can leave meta.json missing or truncated —
  // fall back to the committed copy rather than skip the regression check.
  const prevMeta = await Bun.file(resolve(OUT_DIR, CATALOG_FILES.meta))
    .json()
    .catch(() => {
      const r = spawnSync(
        "git",
        ["show", `HEAD:${CATALOG_DIR}/${CATALOG_FILES.meta}`],
        {
          cwd: REPO_ROOT,
          encoding: "utf8",
        },
      )
      return r.status === 0 ? JSON.parse(r.stdout) : undefined
    })
  const nextCounts = countsFromCatalog(
    byCategory,
    mergedMods,
    arcanesWithImages satisfies Arcane[],
  )
  stats.perCategory = nextCounts.perCategory
  validateOutputs({
    byCategory: byCategory as Record<string, Array<Record<string, unknown>>>,
    mods: mergedMods satisfies Mod[] as unknown as Array<
      Record<string, unknown>
    >,
    arcanes: arcanesWithImages as unknown as Array<Record<string, unknown>>,
    prevMeta,
    nextCounts,
  })
  console.log("  OK  validation (shape + count regression vs previous build)")

  // ---------- 9. Write outputs ----------
  await rm(OUT_DIR, { recursive: true, force: true })
  await mkdir(OUT_DIR, { recursive: true })

  const indexJson = JSON.stringify(byCategory)
  await writeFile(resolve(OUT_DIR, CATALOG_FILES.itemsIndex), indexJson, "utf8")
  console.log(
    `\n  OK  items-index.json (${(indexJson.length / 1024).toFixed(1)} KB)`,
  )

  await writeFile(
    resolve(OUT_DIR, CATALOG_FILES.mods),
    JSON.stringify(mergedMods),
    "utf8",
  )
  console.log(`  OK  mods-all.json (${mergedMods.length} mods)`)

  // Emitted mods with no resolved wiki record (wikiKeyByUniqueName). Their
  // wiki-sourced flags (IsExilus, Tradable, Conclave) silently default, so
  // surface them in _report.json where the weekly refresh diff shows new
  // drift (#297, #399). Avionics come from a separate wiki module — skip them.
  const modsUnmatched = mergedMods
    .filter(
      (m) => !isPlexusMod(m) && !wikiMods.keyByUniqueName.has(m.uniqueName),
    )
    .map((m) => `${m.name} (${m.uniqueName})`)
    .sort()

  // Compact non-tradable list (uniqueNames only). The build viewer skips the
  // ~1.35 MB mods-all.json download for new-format builds, so it loads this to
  // gate the "Warframe Market" link on the mod detail popover (absent = tradable;
  // mods are ~97% tradable, so listing the exceptions stays tiny). See
  // mod-tradable-query.ts + mod-slot.tsx.
  const nonTradable = mergedMods
    .filter((m) => !m.tradable)
    .map((m) => m.uniqueName)
    .sort()
  await writeFile(
    resolve(OUT_DIR, CATALOG_FILES.modTradable),
    JSON.stringify(nonTradable),
    "utf8",
  )
  console.log(`  OK  mod-tradable.json (${nonTradable.length} non-tradable)`)

  await writeFile(
    resolve(OUT_DIR, CATALOG_FILES.modConflicts),
    JSON.stringify(modConflicts),
    "utf8",
  )
  console.log(
    `  OK  mod-conflicts.json (${Object.keys(modConflicts).length} mods)`,
  )

  await writeFile(
    resolve(OUT_DIR, CATALOG_FILES.arcanes),
    JSON.stringify(arcanesWithImages),
    "utf8",
  )
  console.log(`  OK  arcanes-all.json (${arcanesWithImages.length} arcanes)`)

  // Helminth abilities — derived from merged frames + DE's separate
  // ExportAbilities array (which holds the Helminth-native ones). DE
  // doesn't populate `imageName` inline, so fill it from the central
  // image lookup keyed on each ability's uniqueName.
  const subsumableMisses: string[] = []
  const helminthRaw = deriveHelminthAbilities(
    mergedFrames,
    deFramesBlob.ExportAbilities ?? [],
    subsumableMisses,
  )
  for (const miss of subsumableMisses) {
    console.warn(
      `  WARN subsumable-abilities.ts: "${miss}" matches no emitted frame ability — it is missing from the Helminth picker`,
    )
  }
  const helminth = helminthRaw.map((a) => ({
    ...withAbilityStats(a),
    imageName: imageByUniqueName.get(a.uniqueName) ?? a.imageName,
  })) satisfies HelminthAbility[]
  await writeFile(
    resolve(OUT_DIR, CATALOG_FILES.helminthAbilities),
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
  await writeFile(
    resolve(OUT_DIR, CATALOG_FILES.imageMap),
    imageMapBody,
    "utf8",
  )
  console.log(
    `  OK  image-map.json (${Object.keys(imageMap).length} entries, ${(imageMapBody.length / 1024).toFixed(1)} KB)`,
  )

  // Incarnon evolution trees — verbatim passthrough from the curated
  // shared module (lazy-fetched by the editor sidebar).
  const incarnonBody = JSON.stringify(INCARNON_EVOLUTIONS)
  await writeFile(
    resolve(OUT_DIR, CATALOG_FILES.incarnonEvolutions),
    incarnonBody,
    "utf8",
  )
  console.log(
    `  OK  incarnon-evolutions.json (${Object.keys(INCARNON_EVOLUTIONS).length} weapons, ${(incarnonBody.length / 1024).toFixed(1)} KB)`,
  )

  // Modular (Kitgun/Zaw) stat reconstruction tables — fetched by the build
  // editor to recompute a chamber's stats from the selected grip + loader.
  const modularBody = JSON.stringify(modularData)
  await writeFile(resolve(OUT_DIR, CATALOG_FILES.modular), modularBody, "utf8")
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
  const zawByFile = imageUrlByFile(imageByUniqueName, "/Zaws/")
  const zawImages: Record<string, string> = {}
  for (const c of [...ZAW_STRIKES, ...ZAW_GRIPS, ...ZAW_LINKS]) {
    const url = zawByFile.get(c.imageName)
    if (url) zawImages[c.name] = url
  }
  const zawTotal = ZAW_STRIKES.length + ZAW_GRIPS.length + ZAW_LINKS.length
  await writeFile(
    resolve(OUT_DIR, CATALOG_FILES.zawImages),
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
    resolve(OUT_DIR, CATALOG_FILES.kitgunImages),
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

  // Incarnon Genesis adapter icons. The adapters aren't catalog items, so
  // resolve their DE CDN URLs from the manifest by matching each weapon's
  // adapter texture filename (the values in INCARNON_GENESIS_IMAGES), like the
  // zaw thumbnails. Keyed by base weapon name for the editor's incarnon view.
  // Flows through sync:images → R2 like every other catalog image. Innate
  // incarnons have no adapter, so they're absent from INCARNON_GENESIS_IMAGES
  // and from this map.
  const adapterByFile = imageUrlByFile(imageByUniqueName, "/IncarnonWeapons/")
  const incarnonAdapterImages: Record<string, string> = {}
  for (const [name, file] of Object.entries(INCARNON_GENESIS_IMAGES)) {
    const url = adapterByFile.get(file)
    if (url) incarnonAdapterImages[name] = url
  }
  await writeFile(
    resolve(OUT_DIR, CATALOG_FILES.incarnonAdapterImages),
    JSON.stringify(incarnonAdapterImages),
    "utf8",
  )
  const adapterTotal = Object.keys(INCARNON_GENESIS_IMAGES).length
  const adapterResolved = Object.keys(incarnonAdapterImages).length
  if (adapterResolved < adapterTotal) {
    console.warn(
      `  WARN incarnon-adapter-images.json resolved ${adapterResolved}/${adapterTotal} — some adapter textures missing from the manifest`,
    )
  } else {
    console.log(`  OK  incarnon-adapter-images.json (${adapterTotal} adapters)`)
  }

  // Per-item detail files (items/<cat>/<slug>.json).
  await writeItemDetails({
    detailDir: DETAIL_DIR,
    details,
    imageByUniqueName,
    pePlusWeaponTags,
  })

  await writeMeta(OUT_DIR, nextCounts)

  // Report
  await writeFile(
    resolve(OUT_DIR, CATALOG_FILES.report),
    JSON.stringify(
      {
        stats,
        weaponsUnmatched: [...weaponUnmatched].sort(),
        framesUnmatched: [...frameUnmatched].sort(),
        frameRankUpDrift,
        companionsUnmatched: unmatchedDeNames.sort(),
        companionsUnknownType: companionsUnknownType.sort(),
        modsUnmatched,
        abilityStatsUnhandled: [...new Set(abilityStatsUnhandled)].sort(),
        skippedModularComponents: skippedModular.sort(),
        releaseHistoryUnmatched: Object.keys(RELEASE_HISTORY)
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
  console.log(`Mods unmatched (no wiki record):    ${modsUnmatched.length}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
