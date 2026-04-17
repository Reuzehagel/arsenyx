import { getHelminthAbilities } from "@/lib/warframe/helminth"
import { getCategoryCounts, getItemsByCategory } from "@/lib/warframe/items"
// NOTE: Importer intentionally bypasses DB-backed unstable_cache paths.
// We only need a read-only name->uniqueName index for matching.
import { getAllMods as getAllModsJson } from "@/lib/warframe/mods"
import type {
  BrowseCategory,
  BrowseItem,
  HelminthAbility,
  Mod,
} from "@/lib/warframe/types"

import { decodeOverframeBuildString } from "./decode"
import { getOverframeNameById, getOverframeItemsMap } from "./items-map"
import { matchItemByName, matchModByName } from "./match"
import { extractOverframeDataFromHtml } from "./next-data"
import { mapOverframePolarityCode } from "./polarity"
import type {
  OverframeImportResponse,
  OverframeMatchedMod,
  OverframeImportWarning,
  OverframeMatchedHelminthAbility,
} from "./types"

export function isValidOverframeBuildUrl(value: string): boolean {
  try {
    const url = new URL(value)
    if (url.hostname !== "overframe.gg" && url.hostname !== "www.overframe.gg")
      return false
    // Allow both /build/12345 and full slugs: /build/12345/user/slug/
    return /^\/build\/(\d+)(\/|$)/.test(url.pathname)
  } catch {
    return false
  }
}

async function fetchOverframeHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; ArsenyxBot/1.0; +https://arsenyx.com)",
      accept: "text/html,application/xhtml+xml",
    },
    // Overframe content changes slowly; keep conservative caching.
    next: { revalidate: 300 },
  })

  if (!res.ok) {
    throw new Error(`Overframe fetch failed: ${res.status} ${res.statusText}`)
  }

  return res.text()
}

function getAllBrowseItems(): BrowseItem[] {
  // Iterate categories from the precomputed JSON dataset.
  const counts = getCategoryCounts()
  const categories = Object.keys(counts) as BrowseCategory[]

  const items: BrowseItem[] = []
  for (const category of categories) {
    items.push(...getItemsByCategory(category))
  }
  return items
}

function abilityPathLeaf(value: string): string {
  return value.split("/").filter(Boolean).at(-1)?.toLowerCase() ?? value
}

function resolveHelminthAbility(
  overframeUniqueName: string,
): HelminthAbility | null {
  const abilities = getHelminthAbilities()
  const byUniqueName = new Map(
    abilities.map((ability) => [ability.uniqueName, ability]),
  )

  const exact = byUniqueName.get(overframeUniqueName)
  if (exact) return exact

  const overframeLeaf = abilityPathLeaf(overframeUniqueName)
  return (
    abilities.find(
      (ability) => abilityPathLeaf(ability.uniqueName) === overframeLeaf,
    ) ?? null
  )
}

type OverframeSlotLike = {
  slot_id?: unknown
  mod?: unknown
  rank?: unknown
  polarity?: unknown
}

function parseOverframeSlots(
  slots: unknown,
  isWarframe: boolean,
): Array<{
  slotType: "aura" | "exilus" | "normal" | "arcane"
  slotIndex: number
  overframeId: string | null
  rank: number
  polarityCode: number
}> {
  if (!Array.isArray(slots)) return []

  const out: Array<{
    slotType: "aura" | "exilus" | "normal" | "arcane"
    slotIndex: number
    overframeId: string | null
    rank: number
    polarityCode: number
  }> = []

  for (const entry of slots as OverframeSlotLike[]) {
    const slotId = Number(entry?.slot_id)
    const rank = Number(entry?.rank)
    const polarityCode = Number(entry?.polarity ?? 0)

    const modIdRaw = entry?.mod
    const modIdNum = typeof modIdRaw === "number" ? modIdRaw : Number(modIdRaw)
    const hasMod =
      modIdRaw !== null &&
      modIdRaw !== undefined &&
      Number.isFinite(modIdNum) &&
      modIdNum !== 0
    const overframeId = hasMod ? String(modIdRaw) : null

    if (!Number.isFinite(slotId) || !Number.isFinite(rank)) {
      continue
    }

    if (slotId >= 1 && slotId <= 8) {
      // Overframe numbers slots in reverse visual order:
      // - slot_id 8 = top-left (visually first)
      // - slot_id 1 = bottom-right (visually last)
      // Our app displays normal-0 at top-left, normal-7 at bottom-right
      // So we reverse: slotIndex = 8 - slotId
      out.push({
        slotType: "normal",
        slotIndex: 8 - slotId,
        overframeId,
        rank,
        polarityCode: Number.isFinite(polarityCode) ? polarityCode : 0,
      })
    } else if (slotId === 9) {
      // For warframes/necramechs: slot 9 = aura
      // For weapons: slot 9 = exilus (weapons have no aura)
      out.push({
        slotType: isWarframe ? "aura" : "exilus",
        slotIndex: 0,
        overframeId,
        rank,
        polarityCode: Number.isFinite(polarityCode) ? polarityCode : 0,
      })
    } else if (slotId === 10) {
      // For warframes/necramechs: slot 10 = exilus
      // For weapons: slot 10 = arcane
      out.push({
        slotType: isWarframe ? "exilus" : "arcane",
        slotIndex: 0,
        overframeId,
        rank,
        polarityCode: Number.isFinite(polarityCode) ? polarityCode : 0,
      })
    } else if (slotId >= 11) {
      // slot_id 11+ = arcanes (warframes have 2 arcane slots: 11=arcane-0, 12=arcane-1)
      out.push({
        slotType: "arcane",
        slotIndex: isWarframe ? slotId - 11 : slotId - 10,
        overframeId,
        rank,
        polarityCode: Number.isFinite(polarityCode) ? polarityCode : 0,
      })
    }
  }

  return out
}

export async function importOverframeBuild(
  url: string,
): Promise<OverframeImportResponse> {
  const warnings: OverframeImportWarning[] = []

  if (!isValidOverframeBuildUrl(url)) {
    return {
      source: { url },
      item: {},
      formaCount: null,
      mods: [],
      warnings: [
        {
          type: "invalid_url",
          message: "URL must look like https://overframe.gg/build/<id>/...",
        },
      ],
    }
  }

  let html: string
  try {
    html = await fetchOverframeHtml(url)
  } catch (err) {
    return {
      source: { url },
      item: {},
      formaCount: null,
      mods: [],
      warnings: [
        {
          type: "fetch_failed",
          message:
            err instanceof Error
              ? err.message
              : "Failed to fetch Overframe page",
        },
      ],
    }
  }

  const buildId = (() => {
    try {
      const u = new URL(url)
      const m = u.pathname.match(/^\/build\/(\d+)/)
      return m?.[1]
    } catch {
      return undefined
    }
  })()

  const extracted = extractOverframeDataFromHtml(html, { url, buildId })
  if (!extracted.nextData) {
    warnings.push({
      type: "next_data_missing",
      message: "Could not find __NEXT_DATA__ on the Overframe page.",
    })
  }

  // Ensure items.csv is loadable early, so errors are clear.
  try {
    await getOverframeItemsMap()
  } catch (err) {
    warnings.push({
      type: "build_data_missing",
      message:
        "Overframe items map could not be loaded. Ensure src/lib/overframe/data/items.csv exists.",
      details: { error: err instanceof Error ? err.message : String(err) },
    })
  }

  // Item matching (best-effort): use extracted itemName when present.
  // We do this early so we can pass category info to slot parsing.
  const allItems = getAllBrowseItems()
  const { item: matchedItem, score: itemScore } = matchItemByName(
    extracted.itemName,
    allItems,
  )

  if (!matchedItem) {
    warnings.push({
      type: "item_not_found",
      message: extracted.itemName
        ? `Could not confidently match item "${extracted.itemName}" to a known item.`
        : "Could not find an item name in the Overframe page.",
      details: { overframeItemName: extracted.itemName, score: itemScore },
    })
  }

  const matchedCategory = matchedItem?.category
  const isWarframe =
    matchedCategory === "warframes" || matchedCategory === "necramechs"

  let helminthAbility: OverframeMatchedHelminthAbility | undefined
  if (extracted.helminthAbility) {
    const matchedAbility = resolveHelminthAbility(
      extracted.helminthAbility.uniqueName,
    )

    helminthAbility = {
      slotIndex: extracted.helminthAbility.slotIndex,
      overframeUniqueName: extracted.helminthAbility.uniqueName,
      matched: matchedAbility
        ? {
            uniqueName: matchedAbility.uniqueName,
            name: matchedAbility.name,
            imageName: matchedAbility.imageName,
            source: matchedAbility.source,
            description: matchedAbility.description,
          }
        : undefined,
    }

    if (!matchedAbility) {
      warnings.push({
        type: "helminth_ability_not_found",
        message: `No Helminth ability match for "${extracted.helminthAbility.uniqueName}"`,
        details: {
          slotIndex: extracted.helminthAbility.slotIndex,
          overframeUniqueName: extracted.helminthAbility.uniqueName,
        },
      })
    }
  }

  // Prefer canonical slots[] (it includes explicit slot positions).
  const canonicalSlots = parseOverframeSlots(extracted.slots, isWarframe)

  // Keep slot polarity info even when a slot is empty (arcanes don't have polarities).
  const slotPolarities = canonicalSlots
    .filter((s) => s.slotType !== "arcane")
    .map((s) => {
      const slotId =
        s.slotType === "normal" ? `normal-${s.slotIndex}` : `${s.slotType}-0`
      const mapped = mapOverframePolarityCode(s.polarityCode)
      return {
        slotId,
        polarityCode: s.polarityCode,
        polarity: mapped.polarity,
      }
    })
  const slotPolarityById = new Map(
    slotPolarities.map((p) => [p.slotId, p] as const),
  )

  // Fall back to buildstring decoding if slots[] is missing/unknown.
  let slotList:
    | Array<{
        slotType: "aura" | "exilus" | "normal" | "arcane"
        slotIndex: number
        overframeId: string | null
        rank: number
        polarityCode: number
      }>
    | [] = canonicalSlots

  if (slotList.length === 0) {
    if (extracted.buildString) {
      try {
        const decoded = decodeOverframeBuildString(extracted.buildString)
        slotList = decoded.slots.map((s) => ({
          slotType: s.slotType,
          slotIndex: s.slotIndex,
          overframeId: s.overframeId,
          rank: s.rank,
          polarityCode: 0,
        }))
        if (slotList.length === 0) {
          warnings.push({
            type: "buildstring_decode_failed",
            message: "Decoded buildstring but couldn’t interpret it as slots.",
          })
        }
      } catch (err) {
        warnings.push({
          type: "buildstring_decode_failed",
          message:
            err instanceof Error ? err.message : "Failed to decode buildstring",
        })
      }
    } else {
      warnings.push({
        type: "buildstring_missing",
        message: "No buildstring found in __NEXT_DATA__.",
      })
    }
  }

  // Split slots into mod slots and arcane slots
  const modSlots: typeof slotList = []
  const arcaneSlots: typeof slotList = []
  for (const s of slotList) {
    if (s.slotType === "arcane") {
      arcaneSlots.push(s)
    } else {
      modSlots.push(s)
    }
  }

  // Resolve Overframe IDs → English names for mod slots
  const modsWithNames: Array<{
    overframeId: string
    rank: number
    slotId: string
    overframeName?: string
  }> = []
  for (const slot of modSlots) {
    if (!slot.overframeId) continue // empty slot
    const overframeName = await getOverframeNameById(slot.overframeId)
    const slotId =
      slot.slotType === "normal"
        ? `normal-${slot.slotIndex}`
        : `${slot.slotType}-0`
    modsWithNames.push({
      overframeId: slot.overframeId,
      rank: slot.rank,
      slotId,
      overframeName,
    })
  }

  // Build mod match index (JSON dataset; avoids Next.js unstable_cache size limit)
  const allMods: Mod[] = getAllModsJson()

  const matchedMods: OverframeMatchedMod[] = []
  for (const m of modsWithNames) {
    if (!m.overframeName) {
      matchedMods.push({
        overframeId: m.overframeId,
        rank: m.rank,
        slotId: m.slotId,
      })
      warnings.push({
        type: "mod_not_found",
        message: `Overframe ID ${m.overframeId} not found in items.csv map`,
        details: { overframeId: m.overframeId, slotId: m.slotId },
      })
      continue
    }

    const { mod, score } = matchModByName(m.overframeName, allMods)
    if (!mod) {
      matchedMods.push({
        overframeId: m.overframeId,
        overframeName: m.overframeName,
        rank: m.rank,
        slotId: m.slotId,
      })
      warnings.push({
        type: "mod_not_found",
        message: `No WFCD mod match for "${m.overframeName}"`,
        details: {
          overframeName: m.overframeName,
          overframeId: m.overframeId,
          slotId: m.slotId,
          score,
        },
      })
      continue
    }

    matchedMods.push({
      overframeId: m.overframeId,
      overframeName: m.overframeName,
      rank: Math.max(0, Math.min(m.rank, mod.fusionLimit ?? m.rank)),
      slotId: m.slotId,
      slotPolarityCode: slotPolarityById.get(m.slotId)?.polarityCode,
      slotPolarity: slotPolarityById.get(m.slotId)?.polarity,
      matched: { uniqueName: mod.uniqueName, name: mod.name, score },
    })
  }

  // Match arcane slots against WFCD arcane data
  const { getAllArcanes } = await import("@/lib/warframe/mods")
  const allArcanes = getAllArcanes()
  const arcanesByNameLower = new Map(
    allArcanes.map((a) => [a.name.toLowerCase(), a]),
  )
  const matchedArcanes: import("./types").OverframeMatchedArcane[] = []

  for (const slot of arcaneSlots) {
    if (!slot.overframeId) continue
    const overframeName = await getOverframeNameById(slot.overframeId)

    if (!overframeName) {
      warnings.push({
        type: "mod_not_found",
        message: `Overframe arcane ID ${slot.overframeId} not found in items.csv map`,
        details: { overframeId: slot.overframeId },
      })
      continue
    }

    // Match by name against arcanes
    const lowerName = overframeName.toLowerCase().trim()
    const arcane = arcanesByNameLower.get(lowerName)

    if (!arcane) {
      warnings.push({
        type: "mod_not_found",
        message: `No WFCD arcane match for "${overframeName}"`,
        details: {
          overframeName,
          overframeId: slot.overframeId,
          slotIndex: slot.slotIndex,
        },
      })
      matchedArcanes.push({
        overframeId: slot.overframeId,
        overframeName,
        rank: slot.rank,
        slotIndex: slot.slotIndex,
      })
      continue
    }

    matchedArcanes.push({
      overframeId: slot.overframeId,
      overframeName,
      rank: slot.rank,
      slotIndex: slot.slotIndex,
      matched: {
        uniqueName: arcane.uniqueName,
        name: arcane.name,
        imageName: arcane.imageName,
        rarity: arcane.rarity,
        score: 1,
      },
    })
  }

  return {
    source: {
      url,
      pageTitle: extracted.pageTitle,
      pageDescription: extracted.pageDescription,
      guideDescription: extracted.guideDescription,
      buildId,
      buildString: extracted.buildString,
    },
    item: {
      overframeName: extracted.itemName,
      matched: matchedItem
        ? {
            uniqueName: matchedItem.uniqueName,
            name: matchedItem.name,
            category: matchedItem.category,
            score: itemScore,
          }
        : undefined,
    },
    formaCount:
      typeof extracted.formaCount === "number" ? extracted.formaCount : null,
    mods: matchedMods,
    arcanes: matchedArcanes.length > 0 ? matchedArcanes : undefined,
    helminthAbility,
    slotPolarities,
    warnings,
    debug: {
      extractedKeys: extracted.extractedKeys,
    },
  }
}
