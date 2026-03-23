// Server-only utilities for matching Overframe names to WFCD names.

export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/&/g, "and")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

// Handle cases like "Continuity (Primed)" vs "Primed Continuity".
export function expandNameVariants(value: string): string[] {
  const base = value.trim()
  const variants = new Set<string>()
  variants.add(base)

  const paren = base.match(/^(.*)\(([^)]+)\)\s*$/)
  if (paren) {
    const left = paren[1].trim()
    const inside = paren[2].trim()
    if (left && inside) {
      variants.add(`${inside} ${left}`)
      variants.add(`${left} ${inside}`)
    }
  }

  // Also try swapping hyphens and slashes
  variants.add(base.replace(/-/g, " "))

  return [...variants]
}

export function similarity(a: string, b: string): number {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1

  const distance = levenshtein(na, nb)
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 1
  return 1 - distance / maxLen
}

function levenshtein(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  const prev = new Array<number>(n + 1)
  const cur = new Array<number>(n + 1)

  for (let j = 0; j <= n; j++) prev[j] = j

  for (let i = 1; i <= m; i++) {
    cur[0] = i
    const ca = a.charCodeAt(i - 1)
    for (let j = 1; j <= n; j++) {
      const cb = b.charCodeAt(j - 1)
      const cost = ca === cb ? 0 : 1
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost)
    }
    for (let j = 0; j <= n; j++) prev[j] = cur[j]
  }

  return prev[n]
}
