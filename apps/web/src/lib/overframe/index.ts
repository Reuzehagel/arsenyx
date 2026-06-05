import {
  expandNameVariants,
  normalizeName,
  similarity,
  similarityNormalized,
} from "@arsenyx/shared/warframe/name-match"
import { decodeOverframeSlotId } from "@arsenyx/shared/warframe/overframe-slots"
import type { OverframeScrapeResponse } from "@arsenyx/shared/warframe/overframe-wire"
import type { Arcane, Mod, Polarity } from "@arsenyx/shared/warframe/types"

import type { SlotId } from "@/components/build-editor"
import type { SavedBuildData } from "@/lib/queries/build-query"
import type { HelminthAbility } from "@/lib/queries/helminth-query"
import type {
  BrowseCategory,
  BrowseItem,
  DetailItem,
  ItemsIndex,
} from "@/lib/warframe"

// Scrape DTOs are defined once in @arsenyx/shared (the api produces them).
export type ScrapeResponse = OverframeScrapeResponse

export type ApplyWarning = {
  type:
    | "mod_not_found"
    | "arcane_not_found"
    | "helminth_not_found"
    | "slot_out_of_range"
  message: string
}

/**
 * One row per Overframe slot, capturing how it was interpreted. Purely
 * diagnostic — surfaced by the import page's "Copy debug JSON" so slot/forma
 * mismaps are visible without re-deriving the decode by hand. `matchedType`
 * (the matched mod's `type`, e.g. "Stance"/"Melee"/"Primary") is the tell for
 * layout bugs: a Stance mod landing in `exilus`, or an exilus mod in `arcane`.
 */
export type OverframeSlotTrace = {
  ofSlotId: number
  ofName: string | null
  ofPolarityCode: number
  ofPolarity: string | null
  rank: number
  /** Where it landed: a SlotId ("normal-3"/"exilus"/"aura-0"), "arcane-N", or "unmapped". */
  target: string
  kind: "mod" | "arcane" | "unmapped"
  /** Mod slots only: innate polarity, the forma we recorded, the matched mod. */
  innate?: string | null
  forma?: string | null
  matched?: string | null
  matchedType?: string
  note?: string
}

export type ApplyResult = {
  item: BrowseItem
  category: BrowseCategory
  data: SavedBuildData
  buildName?: string
  /** Author's guide prose, normalized for our markdown renderer. */
  guideDescription?: string
  /** Per-slot interpretation trace for the debug payload (not persisted). */
  trace: OverframeSlotTrace[]
  warnings: ApplyWarning[]
}

/**
 * Normalize an Overframe guide into the markdown our viewer renders.
 *
 * - Overframe embeds videos with a `[[ youtube id="VIDEOID" ]]` shortcode our
 *   renderer doesn't understand; rewrite it to a bare youtu.be URL on its own
 *   line, which `MarkdownBody` auto-upgrades to an embedded player. The id may
 *   carry a `?si=...` share suffix — keep only the leading id chars.
 * - Overframe's `guideMarkdown` weaves in root-relative item links like
 *   `[\[Hunt\]](/items/arsenal/213/hunt/)` that 404 anywhere off overframe.gg
 *   (and `MarkdownBody` has no custom anchor renderer to rewrite them). Our
 *   preferred source — `data.description` — has none, but the fallback does, so
 *   drop the link wrapper and keep the de-escaped label text. Absolute external
 *   links (e.g. `https://overframe.gg/...`) are left intact.
 */
function normalizeOverframeGuide(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const normalized = raw
    .replace(
      /\[\[\s*youtube\s+id=["']([A-Za-z0-9_-]+)[^"']*["']\s*\]\]/gi,
      (_m, id: string) => `\n\nhttps://youtu.be/${id}\n\n`,
    )
    .replace(/\[((?:\\.|[^\]\\])*)\]\(\/[^)]*\)/g, (_m, label: string) =>
      label.replace(/\\(.)/g, "$1"),
    )
  return normalized.trim() || undefined
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

/**
 * Adapt the shared Overframe slot mapping to our editor `SlotId` strings.
 * Returns null if the slot_id can't be mapped.
 */
function interpretSlot(
  slot_id: number,
  category: BrowseCategory,
): { kind: "mod"; id: SlotId } | { kind: "arcane"; index: number } | null {
  const mapping = decodeOverframeSlotId(slot_id, category)
  if (!mapping) return null
  if (mapping.kind === "arcane") return mapping
  const id: SlotId =
    mapping.slotType === "exilus" || mapping.slotType === "stance"
      ? mapping.slotType
      : (`${mapping.slotType}-${mapping.slotIndex}` as SlotId)
  return { kind: "mod", id }
}

function innatePolarityFor(
  detail: DetailItem,
  slotId: SlotId,
): Polarity | undefined {
  if (slotId.startsWith("aura-")) {
    const idx = Number(slotId.slice("aura-".length))
    const a = detail.auraPolarity
    if (!a) return undefined
    return (Array.isArray(a) ? a[idx] : idx === 0 ? a : undefined) as
      | Polarity
      | undefined
  }
  if (slotId === "exilus") {
    return (detail.exilusPolarity ?? undefined) as Polarity | undefined
  }
  if (slotId === "stance") {
    return (detail.stancePolarity ?? undefined) as Polarity | undefined
  }
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

  const trace: OverframeSlotTrace[] = []

  for (const rawSlot of scrape.slots) {
    const base = {
      ofSlotId: rawSlot.slot_id,
      ofName: rawSlot.overframeName ?? null,
      ofPolarityCode: rawSlot.polarityCode,
      ofPolarity: rawSlot.polarity ?? null,
      rank: rawSlot.rank,
    }
    const interp = interpretSlot(rawSlot.slot_id, category)
    if (!interp) {
      trace.push({
        ...base,
        target: "unmapped",
        kind: "unmapped",
        note: `slot_id ${rawSlot.slot_id} has no ${category} mapping`,
      })
      continue
    }

    if (interp.kind === "arcane") {
      const target = `arcane-${interp.index}`
      if (!rawSlot.overframeId || !rawSlot.overframeName) {
        trace.push({ ...base, target, kind: "arcane", matched: null })
        continue
      }
      const arcane = arcanesByName.get(normalizeName(rawSlot.overframeName))
      if (!arcane) {
        warnings.push({
          type: "arcane_not_found",
          message: `No arcane match for "${rawSlot.overframeName}"`,
        })
        trace.push({
          ...base,
          target,
          kind: "arcane",
          matched: null,
          note: "no arcane match",
        })
        continue
      }
      while (arcaneSlots.length <= interp.index) arcaneSlots.push(null)
      arcaneSlots[interp.index] = { arcane, rank: rawSlot.rank }
      trace.push({ ...base, target, kind: "arcane", matched: arcane.name })
      continue
    }

    const slotId = interp.id
    const importedPolarity = rawSlot.polarity as Polarity | undefined
    const innate = innatePolarityFor(detailItem, slotId)
    let forma: Polarity | undefined
    if (importedPolarity && importedPolarity !== innate) {
      forma = importedPolarity
      formaPolarities[slotId] = importedPolarity
    } else if (!importedPolarity && innate) {
      // OF reports no polarity but slot has innate → universal forma cleared it.
      forma = "universal"
      formaPolarities[slotId] = "universal"
    }

    let matchedName: string | null = null
    let matchedType: string | undefined
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
        matchedName = matched.name
        matchedType = matched.type
      }
    }

    trace.push({
      ...base,
      target: slotId,
      kind: "mod",
      innate: innate ?? null,
      forma: forma ?? null,
      matched: matchedName,
      matchedType,
      note: rawSlot.overframeName && !matchedName ? "no mod match" : undefined,
    })
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
    guideDescription: normalizeOverframeGuide(scrape.source.guideDescription),
    trace,
    warnings,
  }
}
