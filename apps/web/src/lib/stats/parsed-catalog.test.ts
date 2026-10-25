import type { Arcane, Mod } from "@arsenyx/shared/warframe/types"
import { expect, it } from "vitest"

import arcanes from "../../../public/data/arcanes-all.json"
import mods from "../../../public/data/mods-all.json"
import { parseArcaneStats, parseModStats } from "./parser"
import type { ParsedStat } from "./types"

// What the stat engine reads out of every mod and arcane at max rank, one line
// each. A parser change or a data refresh that changes how any item is read
// shows up as a diff in parsed-catalog.snap.txt, so its blast radius gets
// reviewed instead of discovered. Accept an intended change with
// `bun --filter=arsenyx-web run test -u`.

const MAX_RANK = 99 // parse* clamps to the last levelStats entry

function format(s: ParsedStat): string {
  const sign = s.value >= 0 ? "+" : ""
  const unit = s.operation === "percent_add" ? "%" : ""
  let out = `${s.type} ${sign}${s.value}${unit}`
  if (s.isConditional) {
    out += " (conditional"
    if (s.maxStacks) out += ` ×${s.maxStacks}`
    if (s.condition) out += `, ${s.condition}`
    out += ")"
  }
  return out
}

function line(name: string, stats: ParsedStat[]): string {
  return `${name} | ${stats.length ? stats.map(format).join(" | ") : "—"}`
}

it("parses the catalog the way the snapshot says", async () => {
  const lines = [
    "# Mods",
    ...(mods as unknown as Mod[]).map((mod) =>
      line(mod.name, parseModStats({ mod, rank: MAX_RANK })),
    ),
    "",
    "# Arcanes",
    ...(arcanes as unknown as Arcane[]).map((arcane) =>
      line(arcane.name, parseArcaneStats({ arcane, rank: MAX_RANK })),
    ),
  ]
  await expect(lines.join("\n") + "\n").toMatchFileSnapshot(
    "./parsed-catalog.snap.txt",
  )
})
