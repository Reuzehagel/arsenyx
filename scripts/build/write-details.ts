/**
 * Per-item detail file emit (`items/<cat>/<slug>.json`): serializes the
 * entries browse-index.ts decided, each the merged record with its resolved
 * image URLs stamped in. Also guards the exalted-stance coupling: an exalted
 * melee that renders a stance slot but has no curated locked stance would
 * surface an editable slot for a locked-in-game weapon.
 */

import { mkdir, writeFile } from "node:fs/promises"
import { resolve } from "node:path"

import {
  EXALTED_STANCES,
  FREE_STANCE_EXALTED_MELEES,
} from "../../data/curated/exalted-stances"
import type { DetailEntry } from "./browse-index"
import { exaltedStanceImageKey } from "./resolve-images"

export async function writeItemDetails(opts: {
  detailDir: string
  details: readonly DetailEntry[]
  imageByUniqueName: Map<string, string>
  pePlusWeaponTags: ReadonlyMap<string, unknown>
}): Promise<void> {
  const { detailDir, details, imageByUniqueName, pePlusWeaponTags } = opts

  await mkdir(detailDir, { recursive: true })
  let detailCount = 0
  let detailBytes = 0
  async function writeDetail(
    cat: string,
    slug: string,
    payload: unknown,
  ): Promise<void> {
    await mkdir(resolve(detailDir, cat), { recursive: true })
    const body = JSON.stringify(payload)
    await writeFile(resolve(detailDir, cat, `${slug}.json`), body, "utf8")
    detailCount++
    detailBytes += Buffer.byteLength(body, "utf8")
  }

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

  // Exalted melees that render a stance slot (carry stancePolarity) but have no
  // curated locked stance and aren't a known free-stance exception. The web
  // editor would surface an *editable* stance slot for them, letting a user
  // place a stance that's permanently locked in-game → an unbuildable build.
  const exaltedMeleeMissingStance: string[] = []
  for (const d of details) {
    switch (d.kind) {
      case "weapon": {
        const w = d.record
        // Locked exalted stance (Serene Storm, Primal Fury, …): a permanently
        // installed stance the player can't change. Emit it as item metadata
        // so the editor renders a read-only, pre-filled stance slot (worth
        // +10 capacity). Its polarity matches the slot's `stancePolarity`.
        const stance = EXALTED_STANCES[w.name]
        if (
          d.cat === "exalted-weapons" &&
          w.stancePolarity &&
          !stance &&
          !FREE_STANCE_EXALTED_MELEES.has(w.name)
        ) {
          exaltedMeleeMissingStance.push(w.name)
        }
        await writeDetail(d.cat, d.slug, {
          ...w,
          imageName: imageByUniqueName.get(w.uniqueName),
          compatTags: pePlusWeaponTags.get(w.uniqueName),
          ...(stance && {
            innateStance: {
              name: stance.stanceName,
              imageName: imageByUniqueName.get(
                exaltedStanceImageKey(stance.wikiImage),
              ),
            },
          }),
        })
        break
      }
      case "frame": {
        const f = d.record
        await writeDetail(d.cat, d.slug, {
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
          displayClass: d.displayClass,
        })
        break
      }
      case "companion":
        await writeDetail(d.cat, d.slug, {
          ...d.record,
          imageName: imageByUniqueName.get(d.record.uniqueName),
        })
        break
      case "plexus":
        await writeDetail(d.cat, d.slug, d.record)
        break
    }
  }
  if (exaltedMeleeMissingStance.length > 0) {
    console.warn(
      `  WARN exalted-stances.ts: ${exaltedMeleeMissingStance.length} exalted melee(s) carry a stance slot but no curated locked stance — the editor will show an EDITABLE stance slot for a locked-in-game weapon. Add to EXALTED_STANCES (or FREE_STANCE_EXALTED_MELEES if free):\n${exaltedMeleeMissingStance
        .map((n) => `         - ${n}`)
        .join("\n")}`,
    )
  }
  console.log(
    `  OK  ${detailCount} per-item details (${(detailBytes / 1024 / 1024).toFixed(2)} MB total)`,
  )
}
