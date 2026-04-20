import type { Polarity } from "@arsenyx/shared/warframe/types"

// Overframe numeric codes observed in pageProps.data.slots[].polarity
// Based on empirical testing with a build that applied each polarity.
//
// 0 = none/unchanged
// 1 = madurai
// 2 = vazarin
// 3 = naramon
// 4 = zenurik
// 5 = unairu
// 7 = penjaga
// 8 = umbra
// 9 = any ("Any" / Universal / Omni Forma)
const OVERFRAME_POLARITY_CODE_MAP: Record<number, Polarity | undefined> = {
  0: undefined,
  1: "madurai",
  2: "vazarin",
  3: "naramon",
  4: "zenurik",
  5: "unairu",
  7: "penjaga",
  8: "umbra",
  9: "any",
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
