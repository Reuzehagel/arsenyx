import type { SavedVariant } from "@arsenyx/shared/warframe/build-data"
import { useMemo } from "react"

import type { DetailItem } from "@/lib/catalog"
import {
  deriveFormAxis,
  withFormPolarities,
  type FormAxis,
} from "@/lib/form-axis"

/** The twin-frame form axis for the active variant, plus `effectiveItem`: the
 *  item with the active form's innate polarities, which the layout, slot grid
 *  and forma/capacity maths read. No-op for normal frames. */
export function useFormAxis(
  item: DetailItem,
  variants: SavedVariant[],
  activeIndex: number,
): FormAxis & { effectiveItem: DetailItem } {
  const axis = useMemo(
    () => deriveFormAxis(item, variants, activeIndex),
    [item, variants, activeIndex],
  )
  const effectiveItem = useMemo(
    () => withFormPolarities(item, axis.activeFormIndex),
    [item, axis.activeFormIndex],
  )
  return { ...axis, effectiveItem }
}
