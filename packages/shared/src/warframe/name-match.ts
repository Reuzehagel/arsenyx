export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/['\u2019]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
}

/** Handles patterns like "Continuity (Primed)" ↔ "Primed Continuity". */
export function expandNameVariants(value: string): string[] {
  const base = value.trim()
  const variants = new Set<string>([base])
  const paren = base.match(/^(.*)\(([^)]+)\)\s*$/)
  if (paren) {
    const left = paren[1].trim()
    const inside = paren[2].trim()
    if (left && inside) {
      variants.add(`${inside} ${left}`)
      variants.add(`${left} ${inside}`)
    }
  }
  variants.add(base.replace(/-/g, " "))
  return [...variants]
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

export function similarity(a: string, b: string): number {
  const na = normalizeName(a)
  const nb = normalizeName(b)
  if (!na || !nb) return 0
  if (na === nb) return 1
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(na, nb) / maxLen
}

/** Compare two pre-normalized strings. Saves re-normalizing in hot loops. */
export function similarityNormalized(na: string, nb: string): number {
  if (!na || !nb) return 0
  if (na === nb) return 1
  const maxLen = Math.max(na.length, nb.length)
  if (maxLen === 0) return 1
  return 1 - levenshtein(na, nb) / maxLen
}
