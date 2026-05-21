import { useEffect, useState } from "react"

export const ABILITY_STAT_KEYS = [
  "duration",
  "efficiency",
  "range",
  "strength",
] as const
export type AbilityStatKey = (typeof ABILITY_STAT_KEYS)[number]

const STORAGE_KEY = "arsenyx-ability-stat-order"
const DEFAULT: readonly AbilityStatKey[] = ABILITY_STAT_KEYS

function sanitize(input: unknown): AbilityStatKey[] {
  if (!Array.isArray(input)) return [...DEFAULT]
  const valid = new Set<string>(ABILITY_STAT_KEYS)
  const seen = new Set<AbilityStatKey>()
  const out: AbilityStatKey[] = []
  for (const k of input) {
    if (typeof k === "string" && valid.has(k)) {
      const key = k as AbilityStatKey
      if (!seen.has(key)) {
        seen.add(key)
        out.push(key)
      }
    }
  }
  for (const k of DEFAULT) if (!seen.has(k)) out.push(k)
  return out
}

export function useAbilityStatOrder() {
  const [order, setOrder] = useState<AbilityStatKey[]>(() => [...DEFAULT])

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      if (raw) setOrder(sanitize(JSON.parse(raw)))
    } catch {
      // Corrupt JSON — keep default.
    }
  }, [])

  const commit = (next: AbilityStatKey[]) => {
    setOrder(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
    } catch {
      // Quota / disabled storage — in-memory state still updates.
    }
  }

  return [order, commit] as const
}
