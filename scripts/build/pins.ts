import { existsSync } from "node:fs"
import { readFile, writeFile } from "node:fs/promises"

import { PINS_PATH } from "./paths"

/** One mirrored wiki module, as sync-wiki.ts records it. */
export interface WikiPin {
  module: string
  file: string
  sha256: string
  bytes: number
  fetchedAt: string
}

interface Pins {
  de?: unknown
  wiki?: { fetchedAt?: string; modules?: WikiPin[] }
}

/** data/PINS.json, or `{}` before the first sync has written it. */
export async function readPins(): Promise<Pins> {
  if (!existsSync(PINS_PATH)) return {}
  return JSON.parse(await readFile(PINS_PATH, "utf8")) as Pins
}

/** Replace one section of data/PINS.json, keeping the half the other sync
 *  script (sync-de.ts / sync-wiki.ts) wrote. */
export async function writePinsSection(
  key: keyof Pins,
  section: unknown,
): Promise<void> {
  const merged = { ...(await readPins()), [key]: section }
  await writeFile(PINS_PATH, JSON.stringify(merged, null, 2) + "\n", "utf8")
}
