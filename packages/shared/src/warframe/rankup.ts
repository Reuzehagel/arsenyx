/**
 * Rank 0 → 30 stat gains per warframe. DE PublicExport ships only rank-0
 * stats, so the rank-30 bonus lives here. Frames not listed get
 * `DEFAULT_RANKUP`. The data build (`rankUpDrift` in
 * scripts/build/merge-frames.ts) compares this table against the wiki's
 * `*Rank30` fields and reports every frame where they disagree, so a new
 * frame with unusual gains can't fall back to the default unnoticed.
 */

export type RankUp = {
  health: number
  shield: number
  armor: number
  energy: number
}

export const DEFAULT_RANKUP: RankUp = {
  health: 100,
  shield: 100,
  armor: 0,
  energy: 50,
}

export const RANKUP_BY_NAME: Record<string, RankUp> = {
  Baruuk: { health: 100, shield: 100, armor: 0, energy: 100 },
  "Baruuk Prime": { health: 100, shield: 100, armor: 0, energy: 100 },
  "Chroma Prime": { health: 100, shield: 100, armor: 0, energy: 100 },
  Dante: { health: 90, shield: 90, armor: 0, energy: 70 },
  Garuda: { health: 100, shield: 100, armor: 0, energy: 100 },
  "Garuda Prime": { health: 100, shield: 100, armor: 0, energy: 100 },
  Grendel: { health: 200, shield: 0, armor: 0, energy: 50 },
  "Grendel Prime": { health: 200, shield: 0, armor: 0, energy: 50 },
  Hildryn: { health: 100, shield: 500, armor: 0, energy: 0 },
  "Hildryn Prime": { health: 100, shield: 500, armor: 0, energy: 0 },
  Inaros: { health: 200, shield: 0, armor: 0, energy: 50 },
  "Inaros Prime": { health: 200, shield: 0, armor: 0, energy: 50 },
  Koumei: { health: 100, shield: 100, armor: 0, energy: 100 },
  Kullervo: { health: 200, shield: 0, armor: 100, energy: 50 },
  Lavos: { health: 200, shield: 100, armor: 100, energy: 0 },
  "Lavos Prime": { health: 200, shield: 100, armor: 100, energy: 0 },
  // In-game shows 300 max energy at rank 30; the wiki's 290 is wrong (#387)
  Narin: { health: 100, shield: 100, armor: 0, energy: 100 },
  Nezha: { health: 100, shield: 50, armor: 0, energy: 50 },
  "Nezha Prime": { health: 100, shield: 50, armor: 0, energy: 50 },
  Nidus: { health: 100, shield: 0, armor: 100, energy: 50 },
  "Nidus Prime": { health: 100, shield: 0, armor: 100, energy: 50 },
  "Saryn Prime": { health: 100, shield: 100, armor: 0, energy: 100 },
  Valkyr: { health: 100, shield: 50, armor: 0, energy: 50 },
  "Valkyr Prime": { health: 100, shield: 50, armor: 0, energy: 50 },
  "Volt Prime": { health: 100, shield: 100, armor: 0, energy: 100 },
  Wisp: { health: 100, shield: 100, armor: 0, energy: 100 },
  "Wisp Prime": { health: 100, shield: 100, armor: 0, energy: 100 },
  Xaku: { health: 90, shield: 90, armor: 0, energy: 70 },
  "Xaku Prime": { health: 90, shield: 90, armor: 0, energy: 70 },
  Yareli: { health: 100, shield: 100, armor: 0, energy: 100 },
  "Yareli Prime": { health: 100, shield: 100, armor: 0, energy: 100 },
}

/** Frames whose wiki `*Rank30` values are known wrong, so the build doesn't
 *  report them. Each entry names the source we trust instead. */
export const RANKUP_WIKI_DISPUTED: Record<string, string> = {
  Narin: "in-game max energy is 300; the wiki says 290 (#387)",
}

export function rankUpFor(name: string): RankUp {
  return RANKUP_BY_NAME[name] ?? DEFAULT_RANKUP
}
