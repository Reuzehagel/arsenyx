import type { SavedVariant } from "@/lib/queries/build-query"
import type { FrameForm, ItemAbility } from "@/lib/warframe"

/**
 * Twin-frames (e.g. Sirius & Orion) ship as ONE catalog entity with two
 * switchable "forms" sharing the frame but differing in abilities, Helminth,
 * polarities, and the build variants attached to each. Form is the top axis:
 * each form owns its own variant budget. A variant's `formIndex` selects its
 * form (absent / 0 = primary). Shards are per-variant (not per-form), so each
 * half's variants carry their own.
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
  /** The active form's innate polarities, overriding the item's. Forms have
   *  separate upgrade menus, so each has its own (Sirius aura = Vazarin, Orion
   *  aura = Naramon). Undefined for normal frames (use the item's directly). */
  formPolarities: string[] | undefined
  formAuraPolarity: string | string[] | null | undefined
  formExilusPolarity: string | null | undefined
}

/** Item fields a form's innate polarities override. */
type ItemPolarityFields = {
  polarities?: string[]
  auraPolarity?: string | string[] | null
  exilusPolarity?: string | null
}

/**
 * Overlay the active form's innate polarities onto an item so the layout, slot
 * grid, and forma/capacity maths use the right ones. Twin-frame forms have
 * separate upgrade menus (Sirius aura = Vazarin, Orion aura = Naramon), so each
 * renders its own; a half with none falls back to empty (never the other
 * half's). Returns the same `item` reference for normal frames — they pay
 * nothing. Single source for the overlay shared by the editor and the viewer.
 */
export function applyFormPolarities<T extends ItemPolarityFields>(
  item: T,
  axis: Pick<
    FormAxis,
    "isTwin" | "formPolarities" | "formAuraPolarity" | "formExilusPolarity"
  >,
): T {
  if (!axis.isTwin) return item
  return {
    ...item,
    polarities: axis.formPolarities ?? [],
    auraPolarity: axis.formAuraPolarity ?? null,
    exilusPolarity: axis.formExilusPolarity ?? null,
  } as T
}

export function deriveFormAxis(
  item: { forms?: FrameForm[] },
  variants: SavedVariant[],
  activeIndex: number,
): FormAxis {
  const forms = item.forms
  const activeFormIndex = variants[activeIndex]?.formIndex ?? 0
  const activeForm = forms?.[activeFormIndex]
  const formVariants = variants
    .map((v, globalIndex) => ({ v, globalIndex }))
    .filter(({ v }) => (v.formIndex ?? 0) === activeFormIndex)
  return {
    isTwin: Boolean(forms && forms.length > 1),
    activeFormIndex,
    formAbilities: activeForm?.abilities,
    helminthAllowed: activeFormIndex === 0,
    formNames: forms?.map((f) => f.name.split(/\s*&\s*/)[0]),
    formVariants,
    formActiveLocalIndex: Math.max(
      0,
      formVariants.findIndex((f) => f.globalIndex === activeIndex),
    ),
    formPolarities: activeForm?.polarities,
    formAuraPolarity: activeForm?.auraPolarity,
    formExilusPolarity: activeForm?.exilusPolarity,
  }
}
