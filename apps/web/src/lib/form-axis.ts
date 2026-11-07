import type { SavedVariant } from "@arsenyx/shared/warframe/build-data"
import type { FrameForm, Ability } from "@arsenyx/shared/warframe/types"

/**
 * Twin-frames (e.g. Sirius & Orion) ship as ONE catalog entity with two
 * switchable "forms" sharing the frame but differing in abilities, Helminth,
 * polarities, and the build variants attached to each. Form is the top axis:
 * each form owns its own variant budget. A variant's `formIndex` selects its
 * form (absent / 0 = primary). Shards are per-variant (not per-form).
 *
 * Either brother can be the "Primary Son" who holds the subsumed ability —
 * the player picks — so Helminth is allowed on whichever form a variant builds.
 */
export interface FormAxis {
  /** True when the item has more than one switchable form. */
  isTwin: boolean
  /** The form the active variant builds (0 = primary). */
  activeFormIndex: number
  /** The active form's ability set, overriding `item.abilities`. Undefined for
   *  normal frames. */
  formAbilities: Ability[] | undefined
  /** Short toggle labels — DE names the controlled form first in the combined
   *  name ("Sirius & Orion" → "Sirius"). Undefined for normal frames. */
  formNames: string[] | undefined
  /** Active form's variants paired with their flat-array global index — feeds
   *  the variant bar/tabs (which index locally) and maps back to global. */
  formVariants: { v: SavedVariant; globalIndex: number }[]
  /** The active variant's index within `formVariants` (local space). */
  formActiveLocalIndex: number
}

/** Item fields a form's innate polarities override. */
type ItemPolarityFields = {
  forms?: FrameForm[]
  polarities?: string[]
  auraPolarity?: string | string[] | null
  exilusPolarity?: string | null
}

/**
 * The item as seen by form `formIndex`: twin-frame forms have separate upgrade
 * menus (Sirius aura = Vazarin, Orion aura = Naramon), so the active form's
 * innate polarities replace the item's; a half with none falls back to empty
 * (never the other half's). Normal frames get the same `item` reference back.
 */
export function withFormPolarities<T extends ItemPolarityFields>(
  item: T,
  formIndex: number,
): T {
  const forms = item.forms
  if (!forms || forms.length < 2) return item
  const form = forms[formIndex]
  return {
    ...item,
    polarities: form?.polarities ?? [],
    auraPolarity: form?.auraPolarity ?? null,
    exilusPolarity: form?.exilusPolarity ?? null,
  }
}

export function deriveFormAxis(
  item: { forms?: FrameForm[] },
  variants: SavedVariant[],
  activeIndex: number,
): FormAxis {
  const forms = item.forms
  const activeFormIndex = variants[activeIndex]?.formIndex ?? 0
  const formVariants = variants
    .map((v, globalIndex) => ({ v, globalIndex }))
    .filter(({ v }) => (v.formIndex ?? 0) === activeFormIndex)
  return {
    isTwin: Boolean(forms && forms.length > 1),
    activeFormIndex,
    formAbilities: forms?.[activeFormIndex]?.abilities,
    formNames: forms?.map((f) => f.name.split(/\s*&\s*/)[0]),
    formVariants,
    formActiveLocalIndex: Math.max(
      0,
      formVariants.findIndex((f) => f.globalIndex === activeIndex),
    ),
  }
}
