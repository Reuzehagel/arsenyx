import type { Polarity } from "@arsenyx/shared/warframe/types"

// Overframe numeric codes observed in pageProps.data.slots[].polarity.
// Verified empirically by cross-referencing slots where polarity_match === 2
// (slot polarity == mod's known polarity) across 7 sample builds.
//
// 0 = none/unchanged
// 1 = madurai
// 2 = vazarin
// 3 = naramon
// 5 = penjaga
// 9 = zenurik
//
// Codes 4, 6, 7, 8 are not yet observed; unairu / umbra / any mappings
// remain unknown. Add them once a build with a confirmed match surfaces.
const OVERFRAME_POLARITY_CODE_MAP: Record<number, Polarity | undefined> = {
  0: undefined,
  1: "madurai",
  2: "vazarin",
  3: "naramon",
  5: "penjaga",
  9: "zenurik",
}

export function mapOverframePolarityCode(code: number | null | undefined): {
  code: number | null
  polarity?: Polarity
  isKnown: boolean
} {
  if (code === null || code === undefined || !Number.isFinite(code)) {
    return { code: null, isKnown: false }
  }

  const polarity = OVERFRAME_POLARITY_CODE_MAP[code]
  const isKnown = Object.prototype.hasOwnProperty.call(
    OVERFRAME_POLARITY_CODE_MAP,
    code,
  )

  return { code, polarity, isKnown }
}
