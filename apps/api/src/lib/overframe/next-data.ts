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
  extractedKeys: string[]
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

function findFirstString(
  obj: unknown,
  predicate: (key: string, value: string) => boolean,
): { keyPath: string; value: string } | null {
  const seen = new Set<unknown>()

  function walk(
    value: unknown,
    path: string,
  ): { keyPath: string; value: string } | null {
    if (value && typeof value === "object") {
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
        if (typeof v === "string" && predicate(k, v)) {
          return { keyPath: path ? `${path}.${k}` : k, value: v }
        }
        const res = walk(v, path ? `${path}.${k}` : k)
        if (res) return res
      }
    }

    return null
  }

  return walk(obj, "")
}

function findFirstArray(
  obj: unknown,
  keyName: string,
): { keyPath: string; value: unknown[] } | null {
  const seen = new Set<unknown>()

  function walk(
    value: unknown,
    path: string,
  ): { keyPath: string; value: unknown[] } | null {
    if (value && typeof value === "object") {
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
        if (k === keyName && Array.isArray(v)) {
          return { keyPath: path ? `${path}.${k}` : k, value: v }
        }
        const res = walk(v, path ? `${path}.${k}` : k)
        if (res) return res
      }
    }
    return null
  }

  return walk(obj, "")
}

function findFirstNumber(
  obj: unknown,
  keyNames: string[],
): { keyPath: string; value: number } | null {
  const seen = new Set<unknown>()
  const keySet = new Set(keyNames)

  function walk(
    value: unknown,
    path: string,
  ): { keyPath: string; value: number } | null {
    if (value && typeof value === "object") {
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
        if (keySet.has(k) && typeof v === "number" && Number.isFinite(v)) {
          return { keyPath: path ? `${path}.${k}` : k, value: v }
        }
        const res = walk(v, path ? `${path}.${k}` : k)
        if (res) return res
      }
    }
    return null
  }

  return walk(obj, "")
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
  const seen = new Set<unknown>()

  function walk(
    value: unknown,
    path: string,
  ): {
    keyPath: string
    value: { slotIndex: number; uniqueName: string }
  } | null {
    if (!value || typeof value !== "object") {
      return null
    }

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
      const lower = k.toLowerCase()
      if (lower === "helminthability" || lower === "helminth_ability") {
        const parsed = parseHelminthAbility(v)
        if (parsed) {
          return {
            keyPath: path ? `${path}.${k}` : k,
            value: parsed,
          }
        }
      }

      const res = walk(v, path ? `${path}.${k}` : k)
      if (res) return res
    }

    return null
  }

  return walk(obj, "")
}

export function extractOverframeDataFromHtml(
  html: string,
  source: OverframeBuildSource,
): ExtractedOverframeData {
  const extractedKeys: string[] = []

  const nextData = extractNextDataJson(html)
  if (!nextData) {
    return {
      source,
      nextData: undefined,
      extractedKeys,
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
  if (buildStringRes) extractedKeys.push(buildStringRes.keyPath)

  const slotsRes = findFirstArray(nextData, "slots")
  if (slotsRes) extractedKeys.push(slotsRes.keyPath)

  const itemNameRes = findFirstString(nextData, (k, v) => {
    const lower = k.toLowerCase()
    if (lower !== "name" && lower !== "itemname" && lower !== "item_name")
      return false
    // Avoid matching random unrelated names.
    return typeof v === "string" && v.length >= 3 && v.length <= 60
  })
  if (itemNameRes) extractedKeys.push(itemNameRes.keyPath)

  const formaRes = findFirstNumber(nextData, [
    "forma",
    "formaCount",
    "forma_count",
    "formas",
    "numForma",
    "num_forma",
  ])
  if (formaRes) extractedKeys.push(formaRes.keyPath)

  const pageTitle = readStringAtPath(nextData, [
    "props",
    "pageProps",
    "data",
    "title",
  ])
  if (pageTitle) extractedKeys.push("props.pageProps.data.title")

  const pageDescription = readStringAtPath(nextData, [
    "props",
    "pageProps",
    "pageDescription",
  ])
  if (pageDescription) extractedKeys.push("props.pageProps.pageDescription")

  const guideDescription =
    readStringAtPath(nextData, ["props", "pageProps", "guideMarkdown"]) ??
    readStringAtPath(nextData, ["props", "pageProps", "data", "description"])
  if (guideDescription) {
    extractedKeys.push(
      readStringAtPath(nextData, ["props", "pageProps", "guideMarkdown"])
        ? "props.pageProps.guideMarkdown"
        : "props.pageProps.data.description",
    )
  }

  const helminthAbilityRes = findFirstHelminthAbility(nextData)
  if (helminthAbilityRes) extractedKeys.push(helminthAbilityRes.keyPath)

  return {
    source,
    nextData,
    buildString: buildStringRes?.value,
    slots: slotsRes?.value,
    itemName: itemNameRes?.value,
    formaCount: formaRes?.value,
    pageTitle,
    pageDescription,
    guideDescription,
    helminthAbility: helminthAbilityRes?.value,
    extractedKeys,
  }
}
