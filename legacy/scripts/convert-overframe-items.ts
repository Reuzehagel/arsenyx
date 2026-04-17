import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

function parseItemsCsv(csv: string): Map<string, string> {
  const map = new Map<string, string>();
  const lines = csv.split(/\r?\n/);

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip headers if present
    if (/^id\s*,/i.test(line)) continue;

    const firstComma = line.indexOf(",");
    if (firstComma === -1) continue;

    const id = line.slice(0, firstComma).trim().replace(/^"|"$/g, "");
    if (!id) continue;

    let name = line.slice(firstComma + 1).trim();
    name = name.replace(/^"|"$/g, "");
    name = name.replace(/""/g, '"');

    if (!name) continue;
    map.set(id, name);
  }

  return map;
}

function mapToSortedObject(map: Map<string, string>): Record<string, string> {
  const entries = [...map.entries()].sort((a, b) => {
    const ai = Number(a[0]);
    const bi = Number(b[0]);
    if (Number.isFinite(ai) && Number.isFinite(bi)) return ai - bi;
    return a[0].localeCompare(b[0]);
  });

  const obj: Record<string, string> = {};
  for (const [k, v] of entries) obj[k] = v;
  return obj;
}

async function main() {
  const root = process.cwd();
  const csvPath = join(root, "src", "lib", "overframe", "data", "items.csv");
  const jsonPath = join(root, "src", "lib", "overframe", "data", "items.json");

  const csv = await readFile(csvPath, "utf8");
  const map = parseItemsCsv(csv);
  const obj = mapToSortedObject(map);

  await writeFile(jsonPath, JSON.stringify(obj, null, 2) + "\n", "utf8");

  console.log(`Wrote ${Object.keys(obj).length} entries to ${jsonPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
