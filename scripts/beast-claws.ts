/**
 * Hardcoded beast-companion claw weapons.
 *
 * Why hardcoded: DE's PublicExport does not expose Kavat/Kubrow/Vulpaphyla/
 * Predasite claws as weapon entries (their stats are baked into the pet AI
 * in the game executable). Mods that target them (`compatName: "Claws"`)
 * DO ship in the public export, but the weapons themselves don't — so we
 * surface 17 synthetic weapon entries here so the build editor has
 * something to attach those mods to. Stats sourced from
 * https://wiki.warframe.com/w/Claws_(Beast).
 *
 * If DE ever exports these as real `ExportWeapons` entries (or someone
 * upstreams them into `@wfcd/items`), delete this file and the inject step
 * in `build-items-index.ts`.
 */

import type { BrowseableItem } from "@arsenyx/shared/warframe/types"

type ElementKey =
  | "impact"
  | "puncture"
  | "slash"
  | "heat"
  | "cold"
  | "electricity"
  | "toxin"
  | "magnetic"
  | "viral"
  | "corrosive"
  | "blast"
  | "radiation"
  | "gas"

type PetFamily = "kavat" | "kubrow" | "vulpaphyla" | "predasite" | "helminth"

interface BeastClawSpec {
  name: string
  petName: string
  petUniqueName: string
  /** Used to derive the mod-compatibility groups the claws accept. */
  families: PetFamily[]
  damage: Partial<Record<ElementKey, number>>
  cc: number
  cm: number
  sc: number
  /** Pet image filename in WFCD's CDN — reused as the weapon's icon. */
  petImage: string
}

// Stats: https://wiki.warframe.com/w/Claws_(Beast). Attack speed for all
// beast companions is 1.0/s. Mastery requirement: none.
const SPECS: BeastClawSpec[] = [
  {
    name: "Adarza Claws",
    petName: "Adarza Kavat",
    petUniqueName: "/Lotus/Types/Game/CatbrowPet/MirrorCatbrowPetPowerSuit",
    families: ["kavat"],
    damage: { puncture: 45, slash: 45 },
    cc: 30,
    cm: 2.5,
    sc: 5,
    petImage: "KavatBreedAdarza.png",
  },
  {
    name: "Smeeta Claws",
    petName: "Smeeta Kavat",
    petUniqueName: "/Lotus/Types/Game/CatbrowPet/CheshireCatbrowPetPowerSuit",
    families: ["kavat"],
    damage: { slash: 80 },
    cc: 20,
    cm: 2,
    sc: 7.5,
    petImage: "KavatBreedSmeeta.png",
  },
  {
    name: "Vasca Claws",
    petName: "Vasca Kavat",
    petUniqueName: "/Lotus/Types/Game/CatbrowPet/VampireCatbrowPetPowerSuit",
    families: ["kavat"],
    damage: { slash: 110 },
    cc: 15,
    cm: 2,
    sc: 25,
    petImage: "KavatBreedVasca.png",
  },
  {
    name: "Chesa Bite",
    petName: "Chesa Kubrow",
    petUniqueName: "/Lotus/Types/Game/KubrowPet/RetrieverKubrowPetPowerSuit",
    families: ["kubrow"],
    damage: { impact: 275 },
    cc: 15,
    cm: 1.5,
    sc: 15,
    petImage: "KubrowBreedChesa.png",
  },
  {
    name: "Huras Bite",
    petName: "Huras Kubrow",
    petUniqueName: "/Lotus/Types/Game/KubrowPet/FurtiveKubrowPetPowerSuit",
    families: ["kubrow"],
    damage: { slash: 350 },
    cc: 20,
    cm: 3.5,
    sc: 5,
    petImage: "KubrowBreedHuras.png",
  },
  {
    name: "Raksa Bite",
    petName: "Raksa Kubrow",
    petUniqueName: "/Lotus/Types/Game/KubrowPet/GuardKubrowPetPowerSuit",
    families: ["kubrow"],
    damage: { puncture: 250 },
    cc: 7.5,
    cm: 2.5,
    sc: 20,
    petImage: "KubrowBreedRaksa.png",
  },
  {
    name: "Sahasa Bite",
    petName: "Sahasa Kubrow",
    petUniqueName: "/Lotus/Types/Game/KubrowPet/AdventurerKubrowPetPowerSuit",
    families: ["kubrow"],
    damage: { impact: 300 },
    cc: 10,
    cm: 3,
    sc: 5,
    petImage: "KubrowBreedSahasa.png",
  },
  {
    name: "Sunika Bite",
    petName: "Sunika Kubrow",
    petUniqueName: "/Lotus/Types/Game/KubrowPet/HunterKubrowPetPowerSuit",
    families: ["kubrow"],
    damage: { slash: 550 },
    cc: 7.5,
    cm: 3.5,
    sc: 7.5,
    petImage: "KubrowBreedSunika.png",
  },
  {
    name: "Helminth Charger Bite",
    petName: "Helminth Charger",
    petUniqueName: "/Lotus/Types/Game/KubrowPet/ChargerKubrowPetPowerSuit",
    families: ["kubrow", "helminth"],
    damage: { slash: 200, toxin: 50 },
    cc: 7.5,
    cm: 2.5,
    sc: 25,
    petImage: "KubrowBreedHelminthCharger.png",
  },
  {
    name: "Sly Vulpaphyla Claws",
    petName: "Sly Vulpaphyla",
    petUniqueName:
      "/Lotus/Types/Friendly/Pets/CreaturePets/VulpineInfestedCatbrowPetPowerSuit",
    families: ["kavat", "vulpaphyla"],
    damage: { impact: 40, magnetic: 40 },
    cc: 20,
    cm: 2,
    sc: 20,
    petImage: "KavatBreedSlyVulpaphyla.png",
  },
  {
    name: "Crescent Vulpaphyla Claws",
    petName: "Crescent Vulpaphyla",
    petUniqueName:
      "/Lotus/Types/Friendly/Pets/CreaturePets/HornedInfestedCatbrowPetPowerSuit",
    families: ["kavat", "vulpaphyla"],
    damage: { puncture: 50, electricity: 50 },
    cc: 22.5,
    cm: 2,
    sc: 17.5,
    petImage: "KavatBreedCrescentVulpaphyla.png",
  },
  {
    name: "Panzer Vulpaphyla Claws",
    petName: "Panzer Vulpaphyla",
    petUniqueName:
      "/Lotus/Types/Friendly/Pets/CreaturePets/ArmoredInfestedCatbrowPetPowerSuit",
    families: ["kavat", "vulpaphyla"],
    damage: { slash: 45, toxin: 45 },
    cc: 25,
    cm: 2,
    sc: 12.5,
    petImage: "KavatBreedPanzerVulpaphyla.png",
  },
  {
    name: "Vizier Predasite Claws",
    petName: "Vizier Predasite",
    petUniqueName:
      "/Lotus/Types/Friendly/Pets/CreaturePets/VizierPredatorKubrowPetPowerSuit",
    families: ["kubrow", "predasite"],
    damage: { impact: 150, corrosive: 150 },
    cc: 5,
    cm: 3,
    sc: 30,
    petImage: "KubrowBreedPredasiteVizier.png",
  },
  {
    name: "Pharaoh Predasite Claws",
    petName: "Pharaoh Predasite",
    petUniqueName:
      "/Lotus/Types/Friendly/Pets/CreaturePets/PharaohPredatorKubrowPetPowerSuit",
    families: ["kubrow", "predasite"],
    damage: { puncture: 162, gas: 162 },
    cc: 7.5,
    cm: 2.5,
    sc: 25,
    petImage: "KubrowBreedPredasitePharaoh.png",
  },
  {
    name: "Medjay Predasite Claws",
    petName: "Medjay Predasite",
    petUniqueName:
      "/Lotus/Types/Friendly/Pets/CreaturePets/MedjayPredatorKubrowPetPowerSuit",
    families: ["kubrow", "predasite"],
    damage: { slash: 175, viral: 175 },
    cc: 10,
    cm: 3,
    sc: 20,
    petImage: "KubrowBreedPredasiteMedjay.png",
  },
]

// Order matches `damage{}` field order in WFCD's per-weapon JSON.
const DAMAGE_KEYS_ORDERED: readonly ElementKey[] = [
  "impact",
  "puncture",
  "slash",
  "heat",
  "cold",
  "electricity",
  "toxin",
  "blast",
  "radiation",
  "gas",
  "magnetic",
  "viral",
  "corrosive",
]

const ZERO_FIELDS = ["void", "tau", "cinematic"] as const
const ZERO_DRAINS = ["shieldDrain", "healthDrain", "energyDrain", "true"] as const

// All compat-group keys are lowercased to match the matcher in
// packages/shared/src/warframe/mods.ts which lowercases mod.compatName
// before comparing.
function compatGroupsFor(spec: BeastClawSpec): string[] {
  const groups = new Set<string>(["claws", spec.petName.toLowerCase()])
  for (const fam of spec.families) {
    if (fam === "kavat") groups.add("kavat claws")
    if (fam === "kubrow") groups.add("kubrow claws")
    if (fam === "helminth") groups.add("helminth claws")
    if (fam === "vulpaphyla") groups.add("vulpaphyla")
    if (fam === "predasite") groups.add("predasite")
  }
  return [...groups]
}

function buildBeastClaw(spec: BeastClawSpec): BrowseableItem {
  const total = Object.values(spec.damage).reduce((s, v) => s + (v ?? 0), 0)

  // Full damage object with explicit zeros — matches WFCD shape so consumers
  // that iterate keys don't NaN on undefined.
  const damage: Record<string, number> = { total }
  for (const k of DAMAGE_KEYS_ORDERED) damage[k] = spec.damage[k] ?? 0
  for (const k of ZERO_FIELDS) damage[k] = 0
  for (const k of ZERO_DRAINS) damage[k] = 0

  const damagePerShot = DAMAGE_KEYS_ORDERED.map((k) => spec.damage[k] ?? 0)
  // Pad to length 20 to match WFCD's fixed-shape array.
  while (damagePerShot.length < 20) damagePerShot.push(0)

  // Attack-damage map carries only non-zero types (matches WFCD convention
  // for `attacks[].damage`).
  const attackDamage: Record<string, number> = {}
  for (const [k, v] of Object.entries(spec.damage)) {
    if (v && v > 0) attackDamage[k] = v
  }

  return {
    name: spec.name,
    uniqueName: `/Arsenyx/Synthetic/BeastWeapons/${spec.petName.replace(/\s+/g, "")}Claws`,
    description: `Innate claws/bite attack of the ${spec.petName}. Stats from wiki.warframe.com.`,
    type: "Beast Weapon",
    category: "Melee",
    productCategory: "SentinelWeapons",
    petName: spec.petName,
    petUniqueName: spec.petUniqueName,
    compatGroups: compatGroupsFor(spec),
    damage,
    damagePerShot,
    totalDamage: total,
    criticalChance: spec.cc / 100,
    criticalMultiplier: spec.cm,
    procChance: spec.sc / 100,
    fireRate: 1,
    masteryReq: 0,
    multishot: 1,
    buildQuantity: 1,
    sentinel: true,
    imageName: "/img/items/beast-claws.png",
    wikiAvailable: true,
    tradable: false,
    isPrime: false,
    masterable: false,
    attacks: [
      {
        name: "Normal Attack",
        speed: 1,
        crit_chance: spec.cc,
        crit_mult: spec.cm,
        status_chance: spec.sc,
        damage: attackDamage,
      },
    ],
  } as unknown as BrowseableItem
}

export const BEAST_CLAWS: BrowseableItem[] = SPECS.map(buildBeastClaw)
