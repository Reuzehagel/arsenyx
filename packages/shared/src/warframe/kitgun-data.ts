// Kitgun modular weapon data — part *identity* (names, classes, uniqueNames,
// chamber detection) for the selector UI.
//
// DE ships kitgun chamber/grip/loader parts as zero-stat shells
// (`totalDamage: 0`, `criticalChance: 0`, ...), and the wiki's
// Weapons_data_modular dump is geometry-only. The real per-combination stats
// live in the wiki's `Module:Modular/data` (chamber base crit/status/multi,
// per-grip damage + fire-rate tables, per-loader crit/status/reload/magazine
// modifiers). The build mirrors and parses that module into `/data/modular.json`
// (see scripts/build/merge-modular.ts), and the stat panel reconstructs a
// chamber from the chosen grip + loader at runtime (apps/web/src/lib/stats/modular.ts)
// — the same shape zaws use. The numeric tables intentionally do NOT live here:
// they're generated game data, kept out of hand-maintained source.
//
// The one stat not in any verifiable source is the magnitude of a kitgun's
// *explosion* attack (e.g. Tombfinger): the game derives it from an internal
// multiple absent from every wiki module, so it's left unreconstructed rather
// than guessed.
//
// Everything below (part names, primary/secondary grip split) is sourced from
// DE's ExportWeapons part paths, not from memory. Fortuna (Solaris United) and
// Cambion Drift (Entrati) parts are sold by different vendors, but they
// cross-mix freely: any chamber accepts any loader and any grip of the
// matching class (the wiki's per-chamber build tables list e.g. the Entrati
// "Ulnaris" grip + Entrati loaders under the Fortuna "Catchmoon" chamber).
// Only the grip's class constrains the fit — a secondary chamber takes a
// secondary grip, a primary chamber a primary grip.

export type KitgunClass = "primary" | "secondary"

export interface KitgunGrip {
  name: string
  class: KitgunClass
  /** DE part uniqueName — used at build time to resolve the thumbnail. */
  uniqueName: string
}

export interface KitgunLoader {
  name: string
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
    class: "secondary",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Handle/SUModularSecondaryHandleDPart",
  },
  {
    name: "Haymaker",
    class: "secondary",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Handle/SUModularSecondaryHandleCPart",
  },
  {
    name: "Lovetap",
    class: "secondary",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Handle/SUModularSecondaryHandleBPart",
  },
  {
    name: "Ramble",
    class: "secondary",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Handle/SUModularSecondaryHandleAPart",
  },
  {
    name: "Brash",
    class: "primary",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Primary/SUModularPrimarySet1/Handles/SUModularPrimaryHandleAPart",
  },
  {
    name: "Shrewd",
    class: "primary",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Primary/SUModularPrimarySet1/Handles/SUModularPrimaryHandleBPart",
  },
  {
    name: "Steadyslam",
    class: "primary",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Primary/SUModularPrimarySet1/Handles/SUModularPrimaryHandleCPart",
  },
  {
    name: "Tremor",
    class: "primary",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Primary/SUModularPrimarySet1/Handles/SUModularPrimaryHandleDPart",
  },
  // Entrati (Cambion Drift) — one grip per class.
  {
    name: "Ulnaris",
    class: "secondary",
    uniqueName:
      "/Lotus/Weapons/Infested/Pistols/InfKitGun/Handles/InfSecondaryHandle/InfModularSecondaryHandlePart",
  },
  {
    name: "Palmaris",
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
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularCritICapIClipPart",
  },
  {
    name: "Bellows",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularCapIIClipPart",
  },
  {
    name: "Deepbreath",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularCapIClipPart",
  },
  {
    name: "Flutterfire",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularStatIIReloadIClipPart",
  },
  {
    name: "Killstream",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularCritIIReloadIClipPart",
  },
  {
    name: "Ramflare",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularStatIICapIClipPart",
  },
  {
    name: "Slap",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularReloadIClipPart",
  },
  {
    name: "Slapneedle",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularCritIReloadIClipPart",
  },
  {
    name: "Sparkfire",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularStatICapIClipPart",
  },
  {
    name: "Splat",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularCritIICapIClipPart",
  },
  {
    name: "Stitch",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularCritICapIIClipPart",
  },
  {
    name: "Swiftfire",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularStatIReloadIClipPart",
  },
  {
    name: "Thunderdrum",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularStatICapIIClipPart",
  },
  {
    name: "Zip",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularReloadIIClipPart",
  },
  {
    name: "Zipfire",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularStatIReloadIIClipPart",
  },
  {
    name: "Zipneedle",
    uniqueName:
      "/Lotus/Weapons/SolarisUnited/Secondary/SUModularSecondarySet1/Clip/SUModularCritIReloadIIClipPart",
  },
  // Entrati (Cambion Drift)
  {
    name: "Arcroid",
    uniqueName:
      "/Lotus/Weapons/Infested/Pistols/InfKitGun/Clips/InfSmallClip/InfModularClipSmallCritStatPart",
  },
  {
    name: "Thymoid",
    uniqueName:
      "/Lotus/Weapons/Infested/Pistols/InfKitGun/Clips/InfSmallClip/InfModularClipSmallPart",
  },
  {
    name: "Macro Arcroid",
    uniqueName:
      "/Lotus/Weapons/Infested/Pistols/InfKitGun/Clips/InfClipBig/InfModularClipBigPart",
  },
  {
    name: "Macro Thymoid",
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

/** Default grip + loader for a chamber, used to seed a fresh kitgun build. */
export function defaultKitgunComponents(cls: KitgunClass): KitgunComponents {
  const grip = kitgunGripsFor(cls)[0]
  const loader = KITGUN_LOADERS[0]
  return { grip: grip?.name ?? "", loader: loader?.name ?? "" }
}
