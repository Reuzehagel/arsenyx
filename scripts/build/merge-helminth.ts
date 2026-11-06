/**
 * Derive `helminth-abilities.json` from merged frame data.
 *
 * The Helminth system lets players replace a warframe's 3rd ability slot
 * with either (a) one of the four Helminth-native abilities or (b) a
 * subsumed ability from another warframe. Each frame contributes exactly
 * one "subsumable" ability, listed in data/curated/subsumable-abilities.ts.
 */

import type { HelminthAbility } from "@arsenyx/shared/warframe/build-data"

import { SUBSUMABLE_ABILITIES } from "../../data/curated/subsumable-abilities"
import type { DeFrame } from "./de-types"
import type { MergedFrame } from "./merge-frames"

/** A catalog Helminth entry before ability stats are attached. */
type HelminthAbilityBase = Omit<HelminthAbility, "stats">

/** DE ships Helminth-native abilities in a sibling `ExportAbilities` array
 *  (not as a warframe entry), with the same field shape as warframe
 *  abilities (`abilityUniqueName`, `abilityName`, `description`). */
type RawAbility = NonNullable<DeFrame["abilities"]>[number]

/** `misses` collects SUBSUMABLE_ABILITIES entries that matched no ability. */
export function deriveHelminthAbilities(
  frames: readonly MergedFrame[],
  exportAbilities: readonly RawAbility[],
  misses: string[] = [],
): HelminthAbilityBase[] {
  // Index twin-frame forms by their own name so each twin (e.g. "Orion & Sirius") resolves like a frame.
  const byName = new Map<string, Pick<MergedFrame, "abilities">>()
  for (const f of frames)
    for (const form of f.forms ?? [f]) byName.set(form.name, form)
  const out: HelminthAbilityBase[] = []

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
    } else {
      misses.push(`${frame}: ${abilityName}`)
    }
  }

  out.sort((a, b) => a.name.localeCompare(b.name))
  return out
}
