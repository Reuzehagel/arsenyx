/**
 * Per-item detail file emit (`items/<cat>/<slug>.json`) for weapons, frames,
 * companions, and the synthetic Plexus. Each file is the merged record with
 * its resolved image URL stamped in. Also guards the exalted-stance coupling:
 * an exalted melee that renders a stance slot but has no curated locked stance
 * would surface an editable slot for a locked-in-game weapon.
 */

import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import { slugify } from "@arsenyx/shared/warframe/slugs"

import { categorizeFrame, frameDisplayClass } from "./categorize"
import type { MergedCompanion } from "./merge-companions"
import type { MergedFrame } from "./merge-frames"
import type { MergedWeapon } from "./merge-weapons"
import type { CuratedData } from "./read-curated"
import { exaltedStanceImageKey } from "./resolve-images"

// Exalted melees with a *free* (editable) stance rather than a locked one —
// the documented exception to "every exalted melee ships a locked stance".
// See data/curated/exalted-stances.ts.
const FREE_STANCE_EXALTED_MELEES = new Set([
  "Garuda Talons",
  "Garuda Prime Talons",
])

export async function writeItemDetails(opts: {
  detailDir: string
  weaponDetailByCatAndSlug: Map<string, MergedWeapon>
  mergedFrames: MergedFrame[]
  operators: MergedFrame[]
  mergedCompanions: MergedCompanion[]
  curated: Pick<CuratedData, "exaltedStances" | "plexusDetail">
  imageByUniqueName: Map<string, string>
  pePlusWeaponTags: ReadonlyMap<string, unknown>
}): Promise<void> {
  const {
    detailDir,
    weaponDetailByCatAndSlug,
    mergedFrames,
    operators,
    mergedCompanions,
    curated,
    imageByUniqueName,
    pePlusWeaponTags,
  } = opts

  await mkdir(detailDir, { recursive: true })
  let detailCount = 0
  let detailBytes = 0
  function writeDetail(
    cat: string,
    slug: string,
    payload: unknown,
  ): Promise<void> {
    return mkdir(resolve(detailDir, cat), { recursive: true }).then(
      async () => {
        const body = JSON.stringify(payload)
        await writeFile(resolve(detailDir, cat, `${slug}.json`), body, "utf8")
        detailCount++
        detailBytes += Buffer.byteLength(body, "utf8")
      },
    )
  }

  // Exalted melees that render a stance slot (carry stancePolarity) but have no
  // curated locked stance and aren't a known free-stance exception. The web
  // editor would surface an *editable* stance slot for them, letting a user
  // place a stance that's permanently locked in-game → an unbuildable build.
  const exaltedMeleeMissingStance: string[] = []
  for (const [catSlug, w] of weaponDetailByCatAndSlug) {
    const [cat, slug] = catSlug.split("|")
    if (!cat || !slug) continue
    // Locked exalted stance (Serene Storm, Primal Fury, …): a permanently
    // installed stance the player can't change. Emit it as item metadata so
    // the editor renders a read-only, pre-filled stance slot (worth +10
    // capacity). The stance's own polarity matches the slot's `stancePolarity`.
    const stance = curated.exaltedStances[w.name]
    const innateStance = stance
      ? {
          name: stance.stanceName,
          imageName: imageByUniqueName.get(
            exaltedStanceImageKey(stance.wikiImage),
          ),
        }
      : undefined
    if (
      cat === "exalted-weapons" &&
      w.stancePolarity &&
      !stance &&
      !FREE_STANCE_EXALTED_MELEES.has(w.name)
    ) {
      exaltedMeleeMissingStance.push(w.name)
    }
    await writeDetail(cat, slug, {
      ...w,
      imageName: imageByUniqueName.get(w.uniqueName),
      compatTags: pePlusWeaponTags.get(w.uniqueName),
      ...(innateStance && { innateStance }),
    })
  }
  if (exaltedMeleeMissingStance.length > 0) {
    console.warn(
      `  WARN exalted-stances.ts: ${exaltedMeleeMissingStance.length} exalted melee(s) carry a stance slot but no curated locked stance — the editor will show an EDITABLE stance slot for a locked-in-game weapon. Add to EXALTED_STANCES (or FREE_STANCE_EXALTED_MELEES if free):\n${exaltedMeleeMissingStance
        .map((n) => `         - ${n}`)
        .join("\n")}`,
    )
  }
  for (const f of [...mergedFrames, ...operators]) {
    const cat = categorizeFrame(f)
    if (!cat) continue
    // Ability icons live in the DE manifest under the ability's own
    // uniqueName (e.g. `.../SlashDashNewAbility` → `Power04.png`); DE
    // doesn't populate `a.imageName` on the warframe record itself.
    const resolveAbilityImage = <
      T extends { uniqueName: string; imageName?: string },
    >(
      a: T,
    ): T => ({
      ...a,
      imageName: imageByUniqueName.get(a.uniqueName) ?? a.imageName,
    })
    await writeDetail(cat, slugify(f.name), {
      ...f,
      imageName: imageByUniqueName.get(f.uniqueName),
      abilities: f.abilities.map(resolveAbilityImage),
      // Twin-frames: resolve icons for each form's ability set too.
      ...(f.forms && {
        forms: f.forms.map((form) => ({
          ...form,
          abilities: form.abilities.map(resolveAbilityImage),
        })),
      }),
      displayClass: frameDisplayClass(f),
    })
  }
  for (const c of mergedCompanions) {
    await writeDetail("companions", slugify(c.name), {
      ...c,
      imageName: imageByUniqueName.get(c.uniqueName),
    })
  }
  // Plexus
  await writeDetail("railjack", curated.plexusDetail.slug, curated.plexusDetail)
  console.log(
    `  OK  ${detailCount} per-item details (${(detailBytes / 1024 / 1024).toFixed(2)} MB total)`,
  )
}
