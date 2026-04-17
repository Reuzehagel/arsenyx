import { slugify } from "@/lib/warframe/slugs"
import type { BrowseItem, Mod } from "@/lib/warframe/types"

import { expandNameVariants, normalizeName, similarity } from "./normalize"

export function matchItemByName(
  overframeName: string | undefined,
  candidates: BrowseItem[],
): { item: BrowseItem | null; score: number } {
  if (!overframeName) return { item: null, score: 0 }

  const targetNorm = normalizeName(overframeName)
  const targetSlug = slugify(overframeName)

  let best: BrowseItem | null = null
  let bestScore = 0

  for (const item of candidates) {
    const nameScore = similarity(targetNorm, item.name)
    const slugScore = targetSlug === item.slug ? 1 : 0
    const score = Math.max(nameScore, slugScore)
    if (score > bestScore) {
      best = item
      bestScore = score
    }
  }

  return { item: bestScore >= 0.72 ? best : null, score: bestScore }
}

export function matchModByName(
  overframeName: string,
  mods: Mod[],
): { mod: Mod | null; score: number; bestName: string } {
  const variants = expandNameVariants(overframeName)

  let best: Mod | null = null
  let bestScore = 0
  let bestVariant = overframeName

  for (const variant of variants) {
    const target = normalizeName(variant)
    for (const mod of mods) {
      // Fast exact normalized match
      const modNorm = normalizeName(mod.name)
      if (target === modNorm) {
        return { mod, score: 1, bestName: variant }
      }

      const score = similarity(target, mod.name)
      if (score > bestScore) {
        bestScore = score
        best = mod
        bestVariant = variant
      }
    }
  }

  return {
    mod: bestScore >= 0.78 ? best : null,
    score: bestScore,
    bestName: bestVariant,
  }
}
