import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HEADER_RE = /^id\s*,/i;
const QUOTE_WRAP_RE = /^"|"$/g;
const ESCAPED_QUOTE_RE = /""/g;

function parseItemsCsv(csv: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = csv.split(/\r?\n/);
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    if (HEADER_RE.test(line)) continue;

    const firstComma = line.indexOf(",");
    if (firstComma === -1) continue;

    const id = line.slice(0, firstComma).trim().replace(QUOTE_WRAP_RE, "");
    if (!id) continue;

    let name = line.slice(firstComma + 1).trim();
    name = name.replace(QUOTE_WRAP_RE, "");
    name = name.replace(ESCAPED_QUOTE_RE, '"');

    if (!name) continue;
    map.set(id, name);
  }
  return map;
}

async function loadOverframeItemsMap(): Promise<Map<string, string>> {
  const here = dirname(fileURLToPath(import.meta.url));
  const csvPath = join(here, "data", "items.csv");
  const csv = await readFile(csvPath, "utf8");
  return parseItemsCsv(csv);
}

const overframeItemsMapPromise = loadOverframeItemsMap();

export async function getOverframeItemsMap(): Promise<Map<string, string>> {
  return overframeItemsMapPromise;
}
