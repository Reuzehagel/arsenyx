import { readFile } from "node:fs/promises"
import { join } from "node:path"

const HEADER_RE = /^id\s*,/i
const QUOTE_WRAP_RE = /^"|"$/g
const ESCAPED_QUOTE_RE = /""/g

function parseItemsCsv(csv: string): Map<string, string> {
  // Expected format (examples):
  // 5924,"Archon Vitality"
  // 5925,Archon Intensify
  //
  // Robust enough for quoted names containing commas.
  const map = new Map<string, string>()
  const lines = csv.split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue

    // Skip headers if present
    if (HEADER_RE.test(line)) continue

    const firstComma = line.indexOf(",")
    if (firstComma === -1) continue

    const id = line.slice(0, firstComma).trim().replace(QUOTE_WRAP_RE, "")
    if (!id) continue

    let name = line.slice(firstComma + 1).trim()
    name = name.replace(QUOTE_WRAP_RE, "")
    // Unescape common CSV quote escapes
    name = name.replace(ESCAPED_QUOTE_RE, '"')

    if (!name) continue
    map.set(id, name)
  }
  return map
}

function parseItemsJson(json: string): Map<string, string> {
  const obj = JSON.parse(json) as Record<string, unknown>
  const map = new Map<string, string>()
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") map.set(k, v)
  }
  return map
}

async function loadOverframeItemsMap(): Promise<{
  map: Map<string, string>
  loadedFrom: string
}> {
  // Prefer JSON map (generated once) for speed; fall back to CSV.
  // In Next.js server runtime, process.cwd() is the project root.
  const jsonPath = join(
    process.cwd(),
    "src",
    "lib",
    "overframe",
    "data",
    "items.json",
  )
  const csvPath = join(
    process.cwd(),
    "src",
    "lib",
    "overframe",
    "data",
    "items.csv",
  )

  try {
    const json = await readFile(jsonPath, "utf8")
    return { map: parseItemsJson(json), loadedFrom: jsonPath }
  } catch {
    const csv = await readFile(csvPath, "utf8")
    return { map: parseItemsCsv(csv), loadedFrom: csvPath }
  }
}

const overframeItemsMapPromise = loadOverframeItemsMap()

export async function getOverframeItemsMap(): Promise<{
  map: Map<string, string>
  loadedFrom: string
}> {
  return overframeItemsMapPromise
}

export async function getOverframeNameById(
  overframeId: string,
): Promise<string | undefined> {
  const { map } = await getOverframeItemsMap()
  return map.get(String(overframeId))
}
