/**
 * Derive `helminth-abilities.json` from merged frame data.
 *
 * The Helminth system lets players replace a warframe's 3rd ability slot
 * with either (a) one of the four Helminth-native abilities or (b) a
 * subsumed ability from another warframe. Each frame contributes exactly
 * one "subsumable" ability, listed in `SUBSUMABLE_ABILITIES` below.
 *
 * Output shape matches the existing helminth-abilities.json so the UI's
 * Helminth picker doesn't need changes.
 */

import type { DeFrame } from "./read-de"
import type { MergedFrame } from "./merge-frames"

/** Warframe → subsumed ability name. Mirrors the legacy table in
 *  scripts/build-items-index.ts (preserved verbatim to avoid drift). */
const SUBSUMABLE_ABILITIES: Record<string, string> = {
  Ash: "Shuriken",
  Atlas: "Petrify",
  Banshee: "Silence",
  Baruuk: "Lull",
  Caliban: "Sentient Wrath",
  Citrine: "Fractured Blast",
  Chroma: "Elemental Ward",
  "Cyte-09": "Evade",
  Dagath: "Wyrd Scythes",
  Dante: "Dark Verse",
  Ember: "Fire Blast",
  Equinox: "Rest & Rage",
  Excalibur: "Radial Blind",
  Frost: "Ice Wave",
  Gara: "Spectrorage",
  Garuda: "Blood Altar",
  Gauss: "Thermal Sunder",
  Grendel: "Nourish",
  Gyre: "Coil Horizon",
  Harrow: "Condemn",
  Hildryn: "Pillage",
  Hydroid: "Tempest Barrage",
  Inaros: "Desiccation",
  Ivara: "Quiver",
  Jade: "Ophanim Eyes",
  Khora: "Ensnare",
  Koumei: "Omamori",
  Kullervo: "Wrathful Advance",
  Lavos: "Vial Rush",
  Limbo: "Banish",
  Loki: "Decoy",
  Mag: "Pull",
  Mesa: "Shooting Gallery",
  Mirage: "Eclipse",
  Nekros: "Terrify",
  Nezha: "Fire Walker",
  Nidus: "Larva",
  Nokko: "Brightbonnet",
  Nova: "Null Star",
  Nyx: "Mind Control",
  Oberon: "Smite",
  Octavia: "Resonator",
  Oraxia: "Webbed Embrace",
  Protea: "Dispensary",
  Qorvex: "Chyrinka Pillar",
  Revenant: "Reave",
  Rhino: "Roar",
  Saryn: "Molt",
  Sevagoth: "Gloom",
  Styanax: "Tharros Strike",
  Temple: "Pyrotechnics",
  Titania: "Spellbind",
  Trinity: "Well of Life",
  Uriel: "Remedium",
  Valkyr: "Warcry",
  Vauban: "Tesla Nervos",
  Volt: "Shock",
  Voruna: "Lycath's Hunt",
  Wisp: "Breach Surge",
  Wukong: "Defy",
  Xaku: "Xata's Whisper",
  Yareli: "Aquablades",
  Zephyr: "Airburst",
}

export interface HelminthAbility {
  uniqueName: string
  name: string
  imageName?: string
  description: string
  /** "Helminth" for Helminth-native abilities, or the source warframe name. */
  source: string
}

/** DE ships Helminth-native abilities in a sibling `ExportAbilities` array
 *  (not as a warframe entry), with the same field shape as warframe
 *  abilities (`abilityUniqueName`, `abilityName`, `description`). */
type RawAbility = NonNullable<DeFrame["abilities"]>[number]

export function deriveHelminthAbilities(
  frames: readonly MergedFrame[],
  exportAbilities: readonly RawAbility[],
): HelminthAbility[] {
  const byName = new Map<string, MergedFrame>()
  for (const f of frames) byName.set(f.name, f)
  const out: HelminthAbility[] = []

  for (const a of exportAbilities) {
    out.push({
      uniqueName: a.abilityUniqueName,
      name: a.abilityName,
      imageName: a.imageName,
      description: a.description,
      source: "Helminth",
    })
  }

  // Per-warframe subsumable ability.
  for (const [frame, abilityName] of Object.entries(SUBSUMABLE_ABILITIES)) {
    const f = byName.get(frame)
    const a = f?.abilities.find((x) => x.name === abilityName)
    if (a) {
      out.push({
        uniqueName: a.uniqueName,
        name: a.name,
        imageName: a.imageName,
        description: a.description,
        source: frame,
      })
    }
  }

  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}
