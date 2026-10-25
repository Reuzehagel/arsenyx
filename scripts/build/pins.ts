import { writeFile } from "node:fs/promises"
import { resolve } from "node:path"

const PINS_PATH = resolve(import.meta.dirname, "../../data/PINS.json")

/** Replace one section of data/PINS.json, keeping the half the other sync
 *  script (sync-de.ts / sync-wiki.ts) wrote. */
export async function writePinsSection(
  key: "de" | "wiki",
  section: unknown,
): Promise<void> {
  let existing: Record<string, unknown> = {}
  try {
    existing = JSON.parse(await Bun.file(PINS_PATH).text())
  } catch {
    // First run, no PINS.json yet.
  }
  const merged = { ...existing, [key]: section }
  await writeFile(PINS_PATH, JSON.stringify(merged, null, 2) + "\n", "utf8")
}
