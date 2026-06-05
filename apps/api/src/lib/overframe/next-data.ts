import type { OverframeBuildSource } from "./types"

export interface ExtractedOverframeData {
  source: OverframeBuildSource
  nextData?: unknown
  buildString?: string
  slots?: unknown
  itemName?: string
  formaCount?: number
  pageTitle?: string
  pageDescription?: string
  guideDescription?: string
  helminthAbility?: {
    slotIndex: number
    uniqueName: string
  }
}

function extractNextDataJson(html: string): unknown | null {
  // Overframe embeds a JSON blob in <script id="__NEXT_DATA__" type="application/json">...</script>
  const match = html.match(
    /<script[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
  )
  if (!match) return null

  const raw = match[1]?.trim()
  if (!raw) return null

  try {
    return JSON.parse(raw)
  } catch {
    return null
  }
}

/**
 * Depth-first walk over a parsed JSON tree. For every object entry, `visit`
 * gets `(key, value, keyPath)` and may return a non-null match to stop the
 * walk; otherwise recursion descends into the value. Arrays are recursed
 * element-by-element (with `[i]` appended to the path) but their indices are
 * not themselves visited. A `seen` set guards against cycles. Returns the
 * first match `visit` produces, or null.
 */
function findFirst<T>(
  obj: unknown,
  visit: (key: string, value: unknown, keyPath: string) => T | null,
): T | null {
  const seen = new Set<unknown>()

  function walk(value: unknown, path: string): T | null {
    if (!value || typeof value !== "object") return null
    if (seen.has(value)) return null
    seen.add(value)

    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const res = walk(value[i], `${path}[${i}]`)
        if (res) return res
      }
      return null
    }

    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const keyPath = path ? `${path}.${k}` : k
      const hit = visit(k, v, keyPath)
      if (hit) return hit
      const res = walk(v, keyPath)
      if (res) return res
    }
    return null
  }

  return walk(obj, "")
}

function findFirstString(
  obj: unknown,
  predicate: (key: string, value: string) => boolean,
): { keyPath: string; value: string } | null {
  return findFirst(obj, (k, v, keyPath) =>
    typeof v === "string" && predicate(k, v) ? { keyPath, value: v } : null,
  )
}

function findFirstArray(
  obj: unknown,
  keyName: string,
): { keyPath: string; value: unknown[] } | null {
  return findFirst(obj, (k, v, keyPath) =>
    k === keyName && Array.isArray(v) ? { keyPath, value: v } : null,
  )
}

function readNumberAtPath(obj: unknown, path: string[]): number | undefined {
  let current: unknown = obj
  for (const segment of path) {
    if (!current || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[segment]
  }
  return typeof current === "number" && Number.isFinite(current)
    ? current
    : undefined
}

function readStringAtPath(obj: unknown, path: string[]): string | undefined {
  let current = obj
  for (const segment of path) {
    if (!current || typeof current !== "object") return undefined
    current = (current as Record<string, unknown>)[segment]
  }

  return typeof current === "string" && current.trim()
    ? current.trim()
    : undefined
}

function parseHelminthAbility(
  value: unknown,
): { slotIndex: number; uniqueName: string } | null {
  if (Array.isArray(value)) {
    const slotIndex = Number(value[0])
    const uniqueName = typeof value[1] === "string" ? value[1] : undefined

    if (Number.isInteger(slotIndex) && uniqueName) {
      return { slotIndex, uniqueName }
    }
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>
    const slotIndex = Number(
      record.slotIndex ?? record.slot_index ?? record.slot,
    )
    const uniqueName =
      typeof record.uniqueName === "string"
        ? record.uniqueName
        : typeof record.unique_name === "string"
          ? record.unique_name
          : typeof record.path === "string"
            ? record.path
            : typeof record.ability === "string"
              ? record.ability
              : undefined

    if (Number.isInteger(slotIndex) && uniqueName) {
      return { slotIndex, uniqueName }
    }
  }

  return null
}

function findFirstHelminthAbility(obj: unknown): {
  keyPath: string
  value: { slotIndex: number; uniqueName: string }
} | null {
  return findFirst(obj, (k, v, keyPath) => {
    const lower = k.toLowerCase()
    if (lower !== "helminthability" && lower !== "helminth_ability") return null
    const parsed = parseHelminthAbility(v)
    return parsed ? { keyPath, value: parsed } : null
  })
}

export function extractOverframeDataFromHtml(
  html: string,
  source: OverframeBuildSource,
): ExtractedOverframeData {
  return extractOverframeData(extractNextDataJson(html), source)
}

/**
 * Same extraction as {@link extractOverframeDataFromHtml} but starting from an
 * already-parsed `__NEXT_DATA__` object. The paste/bookmarklet import path
 * reads the JSON straight off the user's loaded Overframe tab (which has
 * already cleared Cloudflare's challenge), so it never has HTML to regex.
 */
export function extractOverframeData(
  nextData: unknown,
  source: OverframeBuildSource,
): ExtractedOverframeData {
  if (!nextData) {
    return {
      source,
      nextData: undefined,
      buildString: undefined,
    }
  }

  const buildStringRes = findFirstString(nextData, (k, v) => {
    if (!k) return false
    const lower = k.toLowerCase()
    if (
      lower !== "buildstring" &&
      lower !== "build_string" &&
      lower !== "build"
    )
      return false
    // We only want a base64-ish string; "build" could be many things.
    // Overframe build strings are usually fairly long and mostly base64url chars.
    return (
      typeof v === "string" && v.length > 20 && /^[A-Za-z0-9_\-+/=]+$/.test(v)
    )
  })

  const slotsRes = findFirstArray(nextData, "slots")

  const itemNameRes = findFirstString(nextData, (k, v) => {
    const lower = k.toLowerCase()
    if (lower !== "name" && lower !== "itemname" && lower !== "item_name")
      return false
    // Avoid matching random unrelated names.
    return typeof v === "string" && v.length >= 3 && v.length <= 60
  })

  // Pinned path — Overframe embeds many `formas` numbers in __NEXT_DATA__
  // (sibling builds, related builds), so a tree walk picks the wrong one.
  const formaPath = ["props", "pageProps", "data", "formas"]
  const formaCount = readNumberAtPath(nextData, formaPath)

  const pageTitle = readStringAtPath(nextData, [
    "props",
    "pageProps",
    "data",
    "title",
  ])

  const pageDescription = readStringAtPath(nextData, [
    "props",
    "pageProps",
    "pageDescription",
  ])

  const guideMarkdown = readStringAtPath(nextData, [
    "props",
    "pageProps",
    "guideMarkdown",
  ])
  const guideDescription =
    guideMarkdown ??
    readStringAtPath(nextData, ["props", "pageProps", "data", "description"])

  const helminthAbilityRes = findFirstHelminthAbility(nextData)

  return {
    source,
    nextData,
    buildString: buildStringRes?.value,
    slots: slotsRes?.value,
    itemName: itemNameRes?.value,
    formaCount,
    pageTitle,
    pageDescription,
    guideDescription,
    helminthAbility: helminthAbilityRes?.value,
  }
}
