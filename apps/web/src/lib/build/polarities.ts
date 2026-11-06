import type { SlotId } from "@arsenyx/shared/warframe/build-data"
import { toPolarity } from "@arsenyx/shared/warframe/polarities"
import { getNormalSlotCount } from "@arsenyx/shared/warframe/slot-layout"
import type { Polarity, BrowseCategory } from "@arsenyx/shared/warframe/types"

import type { DetailItem } from "@/lib/catalog"
import { withFormPolarities } from "@/lib/form-axis"

import { getAuraSlotCount } from "./layout"
import { slotIndex, slotKind } from "./slot-id"

export interface InnatePolarities {
  /** One entry per aura slot (Jade has two); undefined = no innate. */
  aura: (Polarity | undefined)[]
  exilus: Polarity | undefined
  stance: Polarity | undefined
  /** One entry per normal slot. */
  normal: (Polarity | undefined)[]
}

type InnateItem = Pick<
  DetailItem,
  "auraPolarity" | "exilusPolarity" | "stancePolarity" | "polarities" | "forms"
>

/**
 * The item's innate slot polarities, sized to its layout. Pass `formIndex` for
 * a twin-frame form's own polarities; callers that already hold the
 * form-overlaid item (`useFormAxis().effectiveItem`) omit it.
 */
export function getInnatePolarities(
  item: InnateItem,
  category: BrowseCategory,
  formIndex?: number,
): InnatePolarities {
  const src =
    formIndex === undefined ? item : withFormPolarities(item, formIndex)
  const auraRaw = Array.isArray(src.auraPolarity)
    ? src.auraPolarity
    : src.auraPolarity
      ? [src.auraPolarity]
      : []
  return {
    aura: Array.from({ length: getAuraSlotCount(category, src) }, (_, i) =>
      toPolarity(auraRaw[i]),
    ),
    exilus: toPolarity(src.exilusPolarity),
    stance: toPolarity(src.stancePolarity),
    normal: Array.from({ length: getNormalSlotCount(category) }, (_, i) =>
      toPolarity(src.polarities?.[i]),
    ),
  }
}

export function innatePolarityForSlot(
  innates: InnatePolarities,
  id: SlotId,
): Polarity | undefined {
  const kind = slotKind(id)
  if (kind === "exilus" || kind === "stance") return innates[kind]
  return innates[kind][slotIndex(id)]
}
