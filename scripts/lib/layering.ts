import { posix } from "node:path"

/**
 * Which folders may import which. Each rule: files under `from` must not
 * resolve an import into any `forbid` prefix (`allow` lists exact exceptions).
 * Paths are repo-relative with forward slashes.
 */
export interface LayerRule {
  from: string
  forbid: string[]
  allow?: string[]
  why: string
}

export const LAYER_RULES: LayerRule[] = [
  {
    from: "packages/shared/",
    forbid: ["apps/", "scripts/", "data/"],
    why: "shared is the most stable layer; apps depend on it, never the reverse",
  },
  {
    from: "apps/api/",
    forbid: ["apps/web/"],
    why: "only @arsenyx/shared crosses the web/api boundary",
  },
  {
    from: "apps/api/src/lib/",
    forbid: ["apps/api/src/routes/"],
    why: "lib is stable; route modules are the most volatile code in the api",
  },
  {
    from: "apps/web/src/lib/",
    forbid: ["apps/web/src/components/", "apps/web/src/routes/"],
    why: "lib is pure domain/data code; components and routes build on it",
  },
  {
    from: "apps/web/src/components/build-loadout/",
    forbid: [
      "apps/web/src/components/build-editor/",
      "apps/web/src/components/build-viewer/",
    ],
    why: "build-loadout is the rendering both the editor and the viewer share",
  },
  {
    from: "apps/web/src/components/build-viewer/",
    forbid: ["apps/web/src/components/build-editor/"],
    why: "the viewer (and the embed bundle) must not pull in the editor",
  },
  {
    from: "data/curated/",
    forbid: ["scripts/build/"],
    allow: ["scripts/build/de-types.ts"],
    why: "curated data is a leaf; the pipeline reads it, not the other way round",
  },
]

const SPEC_RE =
  /(?:import|export)\s[^'"]*?from\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm

/** Repo-relative target of an import specifier, or null for packages. */
export function resolveSpecifier(
  fromFile: string,
  spec: string,
): string | null {
  if (spec.startsWith(".")) {
    return posix.normalize(posix.join(posix.dirname(fromFile), spec))
  }
  if (spec.startsWith("@/")) return `apps/web/src/${spec.slice(2)}`
  if (spec.startsWith("@arsenyx/shared/")) {
    return `packages/shared/src/${spec.slice("@arsenyx/shared/".length)}`
  }
  return null
}

export interface LayerViolation {
  file: string
  line: number
  target: string
  rule: LayerRule
}

export function findLayerViolations(
  file: string,
  source: string,
  rules: LayerRule[] = LAYER_RULES,
): LayerViolation[] {
  const applicable = rules.filter((r) => file.startsWith(r.from))
  if (applicable.length === 0) return []
  const out: LayerViolation[] = []
  for (const m of source.matchAll(SPEC_RE)) {
    const spec = m[1] ?? m[2] ?? m[3]
    const target = resolveSpecifier(file, spec)
    if (!target) continue
    for (const rule of applicable) {
      const allowed = rule.allow?.some(
        (a) => target === a || `${target}.ts` === a || `${target}.tsx` === a,
      )
      if (!allowed && rule.forbid.some((p) => target.startsWith(p))) {
        const line = source.slice(0, m.index).split("\n").length
        out.push({ file, line, target, rule })
      }
    }
  }
  return out
}
