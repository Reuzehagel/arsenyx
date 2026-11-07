import { readFileSync } from "node:fs"
import { relative } from "node:path"

import { findJsonFiles } from "./json-records"

/** meta.json's build timestamp differs on every build; nothing else may. */
function normalize(rel: string, text: string): string {
  if (rel !== "meta.json") return text
  const { generatedAt: _, ...rest } = JSON.parse(text) as Record<
    string,
    unknown
  >
  return JSON.stringify(rest)
}

/** Repo-agnostic diff of two catalog builds: every `.json` path that exists
 *  in only one of them or whose bytes differ (meta.json minus generatedAt).
 *  Empty means the builds are identical. */
export function diffCatalogDirs(a: string, b: string): string[] {
  const rels = (dir: string) =>
    new Set(
      findJsonFiles(dir).map((f) => relative(dir, f).replaceAll("\\", "/")),
    )
  const left = rels(a)
  const right = rels(b)
  const out: string[] = []
  for (const rel of [...new Set([...left, ...right])].sort()) {
    if (!left.has(rel)) out.push(`+ ${rel}`)
    else if (!right.has(rel)) out.push(`- ${rel}`)
    else {
      const x = normalize(rel, readFileSync(`${a}/${rel}`, "utf8"))
      const y = normalize(rel, readFileSync(`${b}/${rel}`, "utf8"))
      if (x !== y) out.push(`~ ${rel}`)
    }
  }
  return out
}
