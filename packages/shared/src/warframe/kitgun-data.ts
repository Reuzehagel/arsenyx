// Kitgun modular weapon data.
//
// Unlike Zaws — where the strike item carries real base stats and the
// grip/link apply documented additive modifiers (see zaw-data.ts /
// zaw-stats.ts) — DE ships kitgun chamber/grip/loader parts as zero-stat
// shells (`totalDamage: 0`, `criticalChance: 0`, ...) and the wiki's
// Weapons_data_modular dump is geometry-only. The actual per-combination
// stats are computed by the game engine from internal tables that aren't in
// any source we can verify. So this module powers part *selection* only — the
// stat panel is not recomputed from the chosen grip/loader. If a verifiable
// numeric source ever appears, the modifier tables can be layered on top the
// same way zaw-stats.ts does.
//
// Everything below (part names, primary/secondary grip split) is sourced from
// DE's ExportWeapons part paths, not from memory. Fortuna (Solaris United) and
// Cambion Drift (Entrati) parts are sold by different vendors, but they
// cross-mix freely: any chamber accepts any loader and any grip of the
// matching class (the wiki's per-chamber build tables list e.g. the Entrati
// "Ulnaris" grip + Entrati loaders under the Fortuna "Catchmoon" chamber).
// Only the grip's class constrains the fit — a secondary chamber takes a
// secondary grip, a primary chamber a primary grip. `maker` is retained for
// labelling/provenance only; it does not gate compatibility.

export type KitgunMaker = "solaris" | "entrati"
export type KitgunClass = "primary" | "secondary"

export interface KitgunGrip {
  name: string
  maker: KitgunMaker
  class: KitgunClass
  /** DE part uniqueName — used at build time to resolve the thumbnail. */
  uniqueName: string
}

export interface KitgunLoader {
  name: string
  maker: KitgunMaker
  uniqueName: string
}

export interface KitgunComponents {
  grip: string
  loader: string
}

// Grips determine the weapon class: a secondary grip yields a pistol kitgun,
// a primary grip yields a rifle kitgun. The chamber (the browse item) already
// encodes which class it is, so the selector only offers grips matching it.
export const KITGUN_GRIPS: KitgunGrip[] = [
  // Solaris United (Fortuna)
  {
    name: "Gibber",
    maker: "solaris",
    class: "secondary",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Handle/SUModularSecondaryHandleDPart",
  },
  {
    name: "Haymaker",
    maker: "solaris",
    class: "secondary",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Handle/SUModularSecondaryHandleCPart",
  },
  {
    name: "Lovetap",
    maker: "solaris",
    class: "secondary",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Handle/SUModularSecondaryHandleBPart",
  },
  {
    name: "Ramble",
    maker: "solaris",
    class: "secondary",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Handle/SUModularSecondaryHandleAPart",
  },
  {
    name: "Brash",
    maker: "solaris",
    class: "primary",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Primary/SUModularPrimarySet1/Handles/SUModularPrimaryHandleAPart",
  },
  {
    name: "Shrewd",
    maker: "solaris",
    class: "primary",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Primary/SUModularPrimarySet1/Handles/SUModularPrimaryHandleBPart",
  },
  {
    name: "Steadyslam",
    maker: "solaris",
    class: "primary",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Primary/SUModularPrimarySet1/Handles/SUModularPrimaryHandleCPart",
  },
  {
    name: "Tremor",
    maker: "solaris",
    class: "primary",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Primary/SUModularPrimarySet1/Handles/SUModularPrimaryHandleDPart",
  },
  // Entrati (Cambion Drift) — one grip per class.
  {
    name: "Ulnaris",
    maker: "entrati",
    class: "secondary",
    uniqueName:
      "/Lotus/Weapons/Infested/Pistols/InfKitGun/Handles/InfSecondaryHandle/InfModularSecondaryHandlePart",
  },
  {
    name: "Palmaris",
    maker: "entrati",
    class: "primary",
    uniqueName:
      "/Lotus/Weapons/Infested/Pistols/InfKitGun/Handles/InfPrimaryHandle/InfModularPrimaryHandlePart",
  },
]

// Loaders are shared across both classes within a manufacturer.
export const KITGUN_LOADERS: KitgunLoader[] = [
  // Solaris United (Fortuna)
  {
    name: "Bashrack",
    maker: "solaris",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularCritICapIClipPart",
  },
  {
    name: "Bellows",
    maker: "solaris",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularCapIIClipPart",
  },
  {
    name: "Deepbreath",
    maker: "solaris",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularCapIClipPart",
  },
  {
    name: "Flutterfire",
    maker: "solaris",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularStatIIReloadIClipPart",
  },
  {
    name: "Killstream",
    maker: "solaris",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularCritIIReloadIClipPart",
  },
  {
    name: "Ramflare",
    maker: "solaris",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularStatIICapIClipPart",
  },
  {
    name: "Slap",
    maker: "solaris",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularReloadIClipPart",
  },
  {
    name: "Slapneedle",
    maker: "solaris",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularCritIReloadIClipPart",
  },
  {
    name: "Sparkfire",
    maker: "solaris",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularStatICapIClipPart",
  },
  {
    name: "Splat",
    maker: "solaris",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularCritIICapIClipPart",
  },
  {
    name: "Stitch",
    maker: "solaris",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularCritICapIIClipPart",
  },
  {
    name: "Swiftfire",
    maker: "solaris",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularStatIReloadIClipPart",
  },
  {
    name: "Thunderdrum",
    maker: "solaris",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularStatICapIIClipPart",
  },
  {
    name: "Zip",
    maker: "solaris",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularReloadIIClipPart",
  },
  {
    name: "Zipfire",
    maker: "solaris",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularStatIReloadIIClipPart",
  },
  {
    name: "Zipneedle",
    maker: "solaris",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularCritIReloadIIClipPart",
  },
  // Entrati (Cambion Drift)
  {
    name: "Arcroid",
    maker: "entrati",
    uniqueName:
      "/Lotus/Weapons/Infested/Pistols/InfKitGun/Clips/InfSmallClip/InfModularClipSmallCritStatPart",
  },
  {
    name: "Thymoid",
    maker: "entrati",
    uniqueName:
      "/Lotus/Weapons/Infested/Pistols/InfKitGun/Clips/InfSmallClip/InfModularClipSmallPart",
  },
  {
    name: "Macro Arcroid",
    maker: "entrati",
    uniqueName:
      "/Lotus/Weapons/Infested/Pistols/InfKitGun/Clips/InfClipBig/InfModularClipBigPart",
  },
  {
    name: "Macro Thymoid",
    maker: "entrati",
    uniqueName:
      "/Lotus/Weapons/Infested/Pistols/InfKitGun/Clips/InfClipBig/InfModularClipBigCritStatPart",
  },
]

// A kitgun chamber is the browse item the build is anchored to. Detection is
// by the chamber part's uniqueName path — robust across the "(Primary)" /
// "(Secondary)" display-name variants the pipeline emits.
const SOLARIS_CHAMBER_RE =
  /\/SolarisUnited\/Secondary\/SUModularSecondarySet1\/Barrel\//
const ENTRATI_CHAMBER_RE = /\/Infested\/Pistols\/InfKitGun\/Barrels\//

export function isKitgunChamber(uniqueName: string | undefined): boolean {
  if (!uniqueName) return false
  return (
    SOLARIS_CHAMBER_RE.test(uniqueName) || ENTRATI_CHAMBER_RE.test(uniqueName)
  )
}

/** Grips a chamber can use: any maker, but matching the chamber's weapon
 *  class (secondary chamber → secondary grip, primary chamber → primary). */
export function kitgunGripsFor(cls: KitgunClass): KitgunGrip[] {
  return KITGUN_GRIPS.filter((g) => g.class === cls)
}

/** Loaders a chamber can use: every loader, regardless of maker or class. */
export function kitgunLoadersFor(): KitgunLoader[] {
  return KITGUN_LOADERS
}

/** Default grip + loader for a chamber, used to seed a fresh kitgun build. */
export function defaultKitgunComponents(cls: KitgunClass): KitgunComponents {
  const grip = kitgunGripsFor(cls)[0]
  const loader = KITGUN_LOADERS[0]
  return { grip: grip?.name ?? "", loader: loader?.name ?? "" }
}
