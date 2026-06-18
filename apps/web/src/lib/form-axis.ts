import type { SavedVariant } from "@/lib/queries/build-query"
import type { FrameForm, ItemAbility } from "@/lib/warframe"

/**
 * Twin-frames (e.g. Sirius & Orion) ship as ONE catalog entity with two
 * switchable "forms" sharing the frame/shards but differing in abilities,
 * Helminth, and the build variants attached to each. Form is the top axis:
 * each form owns its own variant budget. A variant's `formIndex` selects its
 * form (absent / 0 = primary).
 *
 * Both the editor (`EditorShell`) and the read-only viewer (`BuildViewerBody`)
 * need the same derived view — the active form, its ability set, whether
 * Helminth is allowed, the short toggle labels, and the global↔local index
 * mapping for the form-filtered variant tabs. This is the single source so the
 * two can't drift. Pure (no React) so callers wrap it in `useMemo`.
 */
export interface FormAxis {
  /** True when the item has more than one switchable form. */
  isTwin: boolean
  /** The form the active variant builds (0 = primary). */
  activeFormIndex: number
  /** The active form's ability set, overriding `item.abilities`. Undefined for
   *  normal frames (the caller falls back to `item.abilities`). */
  formAbilities: ItemAbility[] | undefined
  /** Helminth is infused on the primary form only. */
  helminthAllowed: boolean
  /** Short toggle labels — DE names the controlled form first in the combined
   *  name ("Sirius & Orion" → "Sirius", "Orion & Sirius" → "Orion"). Undefined
   *  for normal frames. */
  formNames: string[] | undefined
  /** Active form's variants paired with their flat-array global index — feeds
   *  the variant bar/tabs (which index locally) and maps back to global. */
  formVariants: { v: SavedVariant; globalIndex: number }[]
  /** The active variant's index within `formVariants` (local space). */
  formActiveLocalIndex: number
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
    helminthAllowed: activeFormIndex === 0,
    formNames: forms?.map((f) => f.name.split(/\s*&\s*/)[0]),
    formVariants,
    formActiveLocalIndex: Math.max(
      0,
      formVariants.findIndex((f) => f.globalIndex === activeIndex),
    ),
  }
}
