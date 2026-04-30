import { useQuery } from "@tanstack/react-query"

import { itemsIndexQuery } from "@/lib/items-index-query"
import type { BrowseCategory, BrowseItem } from "@/lib/warframe"

export type RecentItem = BrowseItem & { category: BrowseCategory }

export function useRecentItems(limit = 16): RecentItem[] {
  const { data } = useQuery(itemsIndexQuery)
  if (!data) return []
  const all: RecentItem[] = []
  for (const [cat, arr] of Object.entries(data) as [
    BrowseCategory,
    BrowseItem[],
  ][]) {
    if (!arr) continue
    for (const it of arr) {
      if (it.releaseDate) all.push({ ...it, category: cat })
    }
  }
  all.sort((a, b) => (b.releaseDate ?? "").localeCompare(a.releaseDate ?? ""))
  return all.slice(0, limit)
}

export function formatDate(iso?: string): string {
  if (!iso) return "—"
  const [y, m, d] = iso.split("-")
  return `${y}.${m}.${d}`
}

function assertNever(x: never): never {
  throw new Error(`unhandled BrowseCategory: ${String(x)}`)
}

export function shortCategory(c: BrowseCategory): string {
  switch (c) {
    case "warframes":
      return "WF"
    case "primary":
      return "PRI"
    case "secondary":
      return "SEC"
    case "melee":
      return "MEL"
    case "necramechs":
      return "NEC"
    case "companions":
      return "COM"
    case "companion-weapons":
      return "C·W"
    case "exalted-weapons":
      return "EXA"
    case "archwing":
      return "ARW"
    default:
      return assertNever(c)
  }
}

export function longCategory(c: BrowseCategory): string {
  switch (c) {
    case "warframes":
      return "warframe"
    case "primary":
      return "primary"
    case "secondary":
      return "secondary"
    case "melee":
      return "melee"
    case "necramechs":
      return "necramech"
    case "companions":
      return "companion"
    case "companion-weapons":
      return "companion weapon"
    case "exalted-weapons":
      return "exalted weapon"
    case "archwing":
      return "archwing"
    default:
      return assertNever(c)
  }
}

/** True when the item's name already contains "Prime", so we don't duplicate the tag. */
export function isPrimeRedundant(name: string): boolean {
  return /\bprime\b/i.test(name)
}
