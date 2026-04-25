import {
  expandNameVariants,
  normalizeName,
  similarity,
  similarityNormalized,
} from "@arsenyx/shared/warframe/name-match"
import type { Arcane, Mod, Polarity } from "@arsenyx/shared/warframe/types"

import type { SlotId } from "@/components/build-editor"
import {
  getNormalSlotCount,
  hasExilusSlot,
} from "@/components/build-editor/layout"
import type { SavedBuildData } from "@/lib/build-query"
import type { HelminthAbility } from "@/lib/helminth-query"
import type {
  BrowseCategory,
  BrowseItem,
  DetailItem,
  ItemsIndex,
} from "@/lib/warframe"

export type OverframeRawSlot = {
  slot_id: number
  overframeId: string | null
  overframeName?: string
  rank: number
  polarityCode: number
  polarity?: string
}

export type OverframeWarning = {
  type: string
  message: string
  details?: Record<string, unknown>
}

export type ScrapeResponse = {
  source: {
    url: string
    pageTitle?: string
    pageDescription?: string
    guideDescription?: string
    buildId?: string
    buildString?: string
  }
  itemName?: string
  formaCount: number | null
  slots: OverframeRawSlot[]
  helminthAbility?: { slotIndex: number; uniqueName: string }
  warnings: OverframeWarning[]
}

export type ApplyWarning = {
  type:
    | "mod_not_found"
    | "arcane_not_found"
    | "helminth_not_found"
    | "slot_out_of_range"
  message: string
}

export type ApplyResult = {
  item: BrowseItem
  category: BrowseCategory
  data: SavedBuildData
  buildName?: string
  warnings: ApplyWarning[]
}

export function matchOverframeItem(
  scrape: ScrapeResponse,
  items: ItemsIndex,
): { item: BrowseItem; category: BrowseCategory } | null {
  const all: BrowseItem[] = Object.values(items).flat() as BrowseItem[]
  const { item } = matchItemByName(scrape.itemName, all)
  if (!item) return null
  return { item, category: item.category }
}

function matchItemByName(
  overframeName: string | undefined,
  items: BrowseItem[],
): { item: BrowseItem | null; score: number } {
  if (!overframeName) return { item: null, score: 0 }
  const target = normalizeName(overframeName)
  let best: BrowseItem | null = null
  let bestScore = 0
  for (const item of items) {
    const score = similarity(target, item.name)
    if (score > bestScore) {
      best = item
      bestScore = score
    }
  }
  return { item: bestScore >= 0.72 ? best : null, score: bestScore }
}

interface NormalizedMod {
  mod: Mod
  normName: string
}

function matchModByName(
  overframeName: string,
  normalized: NormalizedMod[],
  byNormName: Map<string, Mod>,
): { mod: Mod | null; score: number } {
  const variants = expandNameVariants(overframeName)
  let best: Mod | null = null
  let bestScore = 0
  for (const variant of variants) {
    const target = normalizeName(variant)
    const exact = byNormName.get(target)
    if (exact) return { mod: exact, score: 1 }
    for (const { mod, normName } of normalized) {
      const score = similarityNormalized(target, normName)
      if (score > bestScore) {
        bestScore = score
        best = mod
      }
    }
  }
  return { mod: bestScore >= 0.78 ? best : null, score: bestScore }
}

// ---------- slot_id interpretation ----------

function isWarframeLike(category: BrowseCategory): boolean {
  return category === "warframes" || category === "necramechs"
}

/**
 * Translate Overframe's slot_id (plus category context) into our SlotId /
 * arcane-slot representation. Returns null if the slot_id cannot be mapped.
 */
function interpretSlot(
  slot_id: number,
  category: BrowseCategory,
): { kind: "mod"; id: SlotId } | { kind: "arcane"; index: number } | null {
  // Highest slot_id is leftmost (normal-0), matching the warframe convention
  // where slot_id 8 → normal-0; we just stretch the inversion to N.
  if (!isWarframeLike(category) && !hasExilusSlot(category)) {
    const normalCount = getNormalSlotCount(category)
    if (slot_id >= 1 && slot_id <= normalCount) {
      return { kind: "mod", id: `normal-${normalCount - slot_id}` as SlotId }
    }
    return null
  }
  if (slot_id >= 1 && slot_id <= 8) {
    return { kind: "mod", id: `normal-${8 - slot_id}` as SlotId }
  }
  const warframeLike = isWarframeLike(category)
  if (slot_id === 9) {
    return warframeLike
      ? { kind: "mod", id: "aura-0" }
      : { kind: "mod", id: "exilus" }
  }
  if (slot_id === 10) {
    return warframeLike
      ? { kind: "mod", id: "exilus" }
      : { kind: "arcane", index: 0 }
  }
  if (slot_id >= 11) {
    return warframeLike
      ? { kind: "arcane", index: slot_id - 11 }
      : { kind: "arcane", index: slot_id - 10 }
  }
  return null
}

function innatePolarityFor(
  detail: DetailItem,
  slotId: SlotId,
): Polarity | undefined {
  if (slotId.startsWith("aura-")) {
    const idx = Number(slotId.slice("aura-".length))
    const a = detail.aura
    if (!a) return undefined
    return (Array.isArray(a) ? a[idx] : idx === 0 ? a : undefined) as
      | Polarity
      | undefined
  }
  if (slotId === "exilus") return undefined // not stored in items index
  if (slotId.startsWith("normal-")) {
    const idx = Number(slotId.slice("normal-".length))
    return (detail.polarities?.[idx] ?? undefined) as Polarity | undefined
  }
  return undefined
}

export function applyOverframeScrape(args: {
  scrape: ScrapeResponse
  item: BrowseItem
  category: BrowseCategory
  detailItem: DetailItem
  mods: Mod[]
  arcanes: Arcane[]
  helminthAbilities: HelminthAbility[]
}): ApplyResult {
  const {
    scrape,
    item,
    category,
    detailItem,
    mods,
    arcanes,
    helminthAbilities,
  } = args
  const warnings: ApplyWarning[] = []
  const slots: NonNullable<SavedBuildData["slots"]> = {}
  const formaPolarities: NonNullable<SavedBuildData["formaPolarities"]> = {}
  const arcaneSlots: NonNullable<SavedBuildData["arcanes"]> = []

  const normalizedMods: NormalizedMod[] = mods.map((m) => ({
    mod: m,
    normName: normalizeName(m.name),
  }))
  const modsByNormName = new Map(
    normalizedMods.map(({ mod, normName }) => [normName, mod]),
  )
  const arcanesByName = new Map(arcanes.map((a) => [normalizeName(a.name), a]))

  for (const rawSlot of scrape.slots) {
    const interp = interpretSlot(rawSlot.slot_id, category)
    if (!interp) continue

    if (interp.kind === "arcane") {
      if (!rawSlot.overframeId || !rawSlot.overframeName) continue
      const arcane = arcanesByName.get(normalizeName(rawSlot.overframeName))
      if (!arcane) {
        warnings.push({
          type: "arcane_not_found",
          message: `No arcane match for "${rawSlot.overframeName}"`,
        })
        continue
      }
      while (arcaneSlots.length <= interp.index) arcaneSlots.push(null)
      arcaneSlots[interp.index] = { arcane, rank: rawSlot.rank }
      continue
    }

    const slotId = interp.id
    const importedPolarity = rawSlot.polarity as Polarity | undefined
    const innate = innatePolarityFor(detailItem, slotId)
    if (importedPolarity && importedPolarity !== innate) {
      formaPolarities[slotId] = importedPolarity
    } else if (!importedPolarity && innate) {
      // OF reports no polarity but slot has innate → universal forma cleared it.
      formaPolarities[slotId] = "universal"
    }

    if (rawSlot.overframeId && rawSlot.overframeName) {
      const match = matchModByName(
        rawSlot.overframeName,
        normalizedMods,
        modsByNormName,
      )
      const matched = match.mod
      if (!matched) {
        warnings.push({
          type: "mod_not_found",
          message: `No mod match for "${rawSlot.overframeName}"`,
        })
      } else {
        const boundedRank = Math.max(
          0,
          Math.min(rawSlot.rank ?? 0, matched.fusionLimit ?? rawSlot.rank ?? 0),
        )
        slots[slotId] = { mod: matched, rank: boundedRank }
      }
    }
  }

  // Helminth: warframes only.
  const helminth: SavedBuildData["helminth"] = {}
  if (scrape.helminthAbility && category === "warframes") {
    const uniqueLeaf = (v: string) =>
      v.split("/").filter(Boolean).at(-1)?.toLowerCase() ?? v
    const ofUnique = scrape.helminthAbility.uniqueName
    const matchedAbility =
      helminthAbilities.find((a) => a.uniqueName === ofUnique) ??
      helminthAbilities.find(
        (a) => uniqueLeaf(a.uniqueName) === uniqueLeaf(ofUnique),
      )
    if (matchedAbility) {
      helminth[scrape.helminthAbility.slotIndex] = matchedAbility
    } else {
      warnings.push({
        type: "helminth_not_found",
        message: `No Helminth ability match for "${scrape.helminthAbility.uniqueName}"`,
      })
    }
  }

  const data: SavedBuildData = {
    version: 1,
    slots,
    formaPolarities,
    arcanes: arcaneSlots,
    hasReactor: true,
    ...(Object.keys(helminth ?? {}).length > 0 ? { helminth } : {}),
  }

  return {
    item,
    category,
    data,
    buildName: scrape.source.pageTitle,
    warnings,
  }
}
