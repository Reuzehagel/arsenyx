import WarframesData from "@/data/warframe/Warframes.json"

import type { Warframe, HelminthAbility } from "./types"

// Manually maintained list of subsumable abilities
// Mapped from Warframe Name -> Ability Name
export const SUBSUMABLE_ABILITIES: Record<string, string> = {
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

/**
 * Get all available Helminth abilities (Native + Subsumable)
 */
export function getHelminthAbilities(): HelminthAbility[] {
  const abilities: HelminthAbility[] = []
  const warframes = WarframesData as unknown as Warframe[]

  // 1. Get Native Helminth Abilities
  const helminth = warframes.find((w) => w.name === "Helminth")
  if (helminth && helminth.abilities) {
    helminth.abilities.forEach((ability) => {
      abilities.push({
        uniqueName: ability.uniqueName,
        name: ability.name,
        imageName: ability.imageName,
        description: ability.description,
        source: "Helminth",
      })
    })
  }

  // 2. Get Subsumable Abilities from other Warframes
  const warframeByName = new Map(warframes.map((w) => [w.name, w]))
  Object.entries(SUBSUMABLE_ABILITIES).forEach(
    ([warframeName, abilityName]) => {
      const warframe = warframeByName.get(warframeName)
      if (warframe && warframe.abilities) {
        const ability = warframe.abilities.find((a) => a.name === abilityName)
        if (ability) {
          abilities.push({
            uniqueName: ability.uniqueName,
            name: ability.name,
            imageName: ability.imageName,
            description: ability.description,
            source: warframeName,
          })
        }
      }
    },
  )

  return abilities.sort((a, b) => a.name.localeCompare(b.name))
}
