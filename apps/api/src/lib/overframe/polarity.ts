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

/** Map an Overframe polarity code to our `Polarity`, or `undefined` for the
 *  "none" code (0) and any code not yet observed. */
export function mapOverframePolarity(code: number): Polarity | undefined {
  return OVERFRAME_POLARITY_CODE_MAP[code]
}
