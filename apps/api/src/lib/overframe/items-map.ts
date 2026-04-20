import { OVERFRAME_ITEMS_CSV } from "./data/items-csv"

const HEADER_RE = /^id\s*,/i
const QUOTE_WRAP_RE = /^"|"$/g
const ESCAPED_QUOTE_RE = /""/g

function parseItemsCsv(csv: string): Map<string, string> {
  const map = new Map<string, string>()
  const lines = csv.split(/\r?\n/)
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) continue
    if (HEADER_RE.test(line)) continue

    const firstComma = line.indexOf(",")
    if (firstComma === -1) continue

    const id = line.slice(0, firstComma).trim().replace(QUOTE_WRAP_RE, "")
    if (!id) continue

    let name = line.slice(firstComma + 1).trim()
    name = name.replace(QUOTE_WRAP_RE, "")
    name = name.replace(ESCAPED_QUOTE_RE, '"')

    if (!name) continue
    map.set(id, name)
  }
  return map
}

const overframeItemsMap = parseItemsCsv(OVERFRAME_ITEMS_CSV)

export function getOverframeItemsMap(): Map<string, string> {
  return overframeItemsMap
}
