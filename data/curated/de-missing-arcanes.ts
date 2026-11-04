/**
 * Tektolyst Artifact arcanes (Zid-An, Update 41) that DE's PublicExport has
 * never shipped — `ExportRelicArcane_en.json` has no `/CosmeticEnhancers/
 * Antiques/` rows as of 2026-11-04, while the wiki Arcane module lists all
 * five. The build injects these into the raw DE arcane list before
 * `mergeArcanes` (same splice as de-missing-mods.ts), so the wiki join supplies
 * their image and `slotType` ("Tektolyst Artifacts") like any other arcane.
 *
 * Per-rank values are the rank 0–5 tables on each arcane's wiki page
 * (wiki.warframe.com/w/Zid-An_Asheir etc.); wording follows the wiki
 * Description. The build warns when DE ships one again; delete the entry then.
 */

import type { DeUpgrade } from "../../scripts/build/read-de"

const ranks = (fn: (r: number) => string[]) =>
  [1, 2, 3, 4, 5, 6].map((r) => ({ stats: fn(r) }))

/** `r` × `step`, printed without float noise (1.5 × 3 = 4.5, not 4.5000001). */
const n = (r: number, step: number) => String(Math.round(r * step * 10) / 10)

export const DE_MISSING_ARCANES: readonly DeUpgrade[] = [
  {
    uniqueName:
      "/Lotus/Upgrades/CosmeticEnhancers/Antiques/StatusChanceOnUltimateHit",
    name: "Zid-An Asheir",
    rarity: "RARE",
    levelStats: ranks((r) => [
      `${r}% Status chance for all Warframe weapons for each enemy hit with Tauron Strike, up to 300%. Buff lasts for 30s`,
      `+${n(r, 3)}% Tauron Strike Initial Charge.`,
    ]),
  },
  {
    uniqueName:
      "/Lotus/Upgrades/CosmeticEnhancers/Antiques/AmmoEfficencyDuringUltimate",
    name: "Zid-An Haras",
    rarity: "RARE",
    levelStats: ranks((r) => [
      `${n(r, 8)}% Warframe Ammo Efficiency for 30s after executing Tauron Strike`,
      `+${n(r, 3)}% Amp Ammo Efficiency`,
    ]),
  },
  {
    uniqueName:
      "/Lotus/Upgrades/CosmeticEnhancers/Antiques/VoidSlingsOverguardStrip",
    name: "Zid-An Osbok",
    rarity: "RARE",
    levelStats: ranks((r) => [
      `Void Sling strips ${n(r, 5)}% of enemy Overguard.`,
      `When Overguard is stripped: +${(r * 0.5).toFixed(1)}x Amp Critical Damage for 15s.`,
    ]),
  },
  {
    uniqueName:
      "/Lotus/Upgrades/CosmeticEnhancers/Antiques/UltimateInvisibilty",
    name: "Zid-An Sek-Eel",
    rarity: "RARE",
    levelStats: ranks((r) => [
      "Gain invisibility for 30s after activating Tauron Strike",
      `+${n(r, 1.5)}% Tauron Strike Charge Rate`,
    ]),
  },
  {
    uniqueName:
      "/Lotus/Upgrades/CosmeticEnhancers/Antiques/HeatStatusProcOnUltimateKill",
    name: "Zid-An Uskos",
    rarity: "RARE",
    levelStats: ranks((r) => [
      `On Operator and Tauron Strike Kill: ${(r * 0.4).toFixed(1)}% <DT_FIRE_COLOR>Heat Damage for Secondary Weapon for duration of mission, max 250%`,
    ]),
  },
]
