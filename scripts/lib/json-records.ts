/** Helpers for scripts that walk catalog JSON as untyped records. */

import { readdirSync } from "node:fs"
import { resolve } from "node:path"

export type Json = unknown
export type Rec = Record<string, Json>

export const isRec = (v: Json): v is Rec =>
  typeof v === "object" && v !== null && !Array.isArray(v)

export const same = (a: Json, b: Json) =>
  JSON.stringify(a) === JSON.stringify(b)

/** A record's `uniqueName`, the key catalog lists are matched by. */
export const uniqueNameOf = (v: Json) =>
  isRec(v) && typeof v.uniqueName === "string" ? v.uniqueName : undefined

/** Recursively collect every `.json` file under `dir`. */
export function findJsonFiles(dir: string): string[] {
  const out: string[] = []
  for (const ent of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, ent.name)
    if (ent.isDirectory()) out.push(...findJsonFiles(path))
    else if (ent.name.endsWith(".json")) out.push(path)
  }
  return out
}
