/**
 * Mods DE's PublicExport dropped but that are still in-game (issue #377).
 *
 * `ExportUpgrades_en.json` lost these records in June 2026 (still absent
 * as of 2026-09-09) while their Flawed `/Beginner/` siblings remain and the
 * wiki still lists all three. The build injects these into the raw DE list
 * before `mergeMods` (see scripts/build/de-missing-mods.ts), so they flow
 * through the same polarity / rarity / wiki-flag / image pipeline as every
 * other mod. Images come from the wiki fallback in resolve-images.ts.
 *
 * Records are verbatim copies of DE's last-shipped rows (the pre-#241
 * catalog reproduces them exactly). Keep DE's raw enum spellings
 * (`AP_DEFENSE`, `RARE`, `WARFRAME`, …) — the merge maps them.
 *
 * The build warns when DE ships one of these again; delete the entry then.
 */

import type { DeUpgrade } from "../../scripts/build/read-de"

const quickThinking = (pct: number) =>
  `Drains Energy to stop Lethal Damage with +${pct}% Efficiency.`

export const DE_MISSING_MODS: readonly DeUpgrade[] = [
  {
    uniqueName: "/Lotus/Upgrades/Mods/Warframe/AvatarPowerToHealthOnDeathMod",
    name: "Quick Thinking",
    polarity: "AP_DEFENSE",
    rarity: "RARE",
    codexSecret: false,
    baseDrain: 10,
    fusionLimit: 5,
    compatName: "WARFRAME",
    type: "WARFRAME",
    levelStats: [40, 80, 120, 160, 200, 240].map((p) => ({
      stats: [quickThinking(p)],
    })),
  },
  {
    uniqueName: "/Lotus/Upgrades/Mods/Warframe/AvatarSlideBoostMod",
    name: "Maglev",
    polarity: "AP_TACTIC",
    rarity: "UNCOMMON",
    codexSecret: false,
    baseDrain: 6,
    fusionLimit: 5,
    compatName: "WARFRAME",
    type: "WARFRAME",
    levelStats: [5, 10, 15, 20, 25, 30].map((p) => ({
      stats: [`+${p}% Slide`, `-${p}% Friction`],
    })),
  },
  {
    uniqueName: "/Lotus/Weapons/Tenno/Melee/MeleeTrees/StaffCmbOneMeleeTree",
    name: "Clashing Forest",
    polarity: "AP_ATTACK",
    rarity: "UNCOMMON",
    codexSecret: false,
    baseDrain: -2,
    fusionLimit: 3,
    compatName: "Staves",
    type: "STANCE",
    description: ["Arcing strikes and focused combos."],
  },
]
