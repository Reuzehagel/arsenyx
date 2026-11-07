/** Three-way merge of one catalog file, for scripts/patch-catalog.ts. */

import { isRec, same, uniqueNameOf, type Json, type Rec } from "./json-records"

/** Apply the base→fixed delta onto head. `log` collects human-readable paths. */
export function patch(
  head: Json,
  base: Json,
  fixed: Json,
  path: string,
  log: string[],
): Json {
  if (same(base, fixed)) return head
  if (Array.isArray(head) && Array.isArray(base) && Array.isArray(fixed)) {
    if ([...base, ...fixed].every((v) => uniqueNameOf(v) !== undefined)) {
      const b = new Map(base.map((v) => [uniqueNameOf(v)!, v]))
      const f = new Map(fixed.map((v) => [uniqueNameOf(v)!, v]))
      const out: Json[] = []
      for (const h of head) {
        const k = uniqueNameOf(h)
        if (k === undefined || !b.has(k)) {
          // In fixed but not base: this fix adds the record and an earlier run
          // already did. Refresh it so a re-run picks up later edits to the fix.
          const fresh = k === undefined ? undefined : f.get(k)
          if (fresh !== undefined && !same(h, fresh))
            log.push(`${path}[${k}] refreshed`)
          out.push(fresh ?? h)
        } else if (!f.has(k)) log.push(`${path}[${k}] removed`)
        else out.push(patch(h, b.get(k), f.get(k), `${path}[${k}]`, log))
      }
      for (const [k, v] of f) {
        if (b.has(k)) continue
        if (head.some((h) => uniqueNameOf(h) === k)) continue
        out.push(v)
        log.push(`${path}[${k}] added`)
      }
      return out
    }
    if ([...base, ...fixed].every((v) => typeof v === "string")) {
      const removed = base.filter((v) => !fixed.includes(v))
      const added = fixed.filter((v) => !base.includes(v) && !head.includes(v))
      for (const v of removed) log.push(`${path} -${String(v)}`)
      for (const v of added) log.push(`${path} +${String(v)}`)
      const out = [...head.filter((v) => !removed.includes(v)), ...added]
      const wasSorted = head.every(
        (v, i) => i === 0 || String(head[i - 1]) <= String(v),
      )
      return wasSorted ? (out as string[]).sort() : out
    }
  } else if (isRec(head) && isRec(base) && isRec(fixed)) {
    const out: Rec = { ...head }
    for (const k of new Set([...Object.keys(base), ...Object.keys(fixed)])) {
      if (same(base[k], fixed[k])) continue
      if (!(k in fixed)) {
        delete out[k]
        log.push(`${path}.${k} removed`)
      } else if (k in head && k in base) {
        out[k] = patch(head[k], base[k], fixed[k], `${path}.${k}`, log)
      } else {
        out[k] = fixed[k]
        log.push(`${path}.${k} = ${JSON.stringify(fixed[k])}`)
      }
    }
    return out
  }
  log.push(`${path}: ${JSON.stringify(head)} → ${JSON.stringify(fixed)}`)
  return fixed
}
