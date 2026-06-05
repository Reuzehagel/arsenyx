import type { Polarity } from "@arsenyx/shared/warframe/types"

// Overframe numeric codes observed in pageProps.data.slots[].polarity.
//
// 0 = none/unchanged
// 1 = madurai
// 2 = vazarin
// 3 = naramon
// 5 = penjaga
// 9 = "any" — the Universal ("Any" / Aya) forma that matches every mod.
//     NB: this is our `"any"` polarity, NOT `"universal"`. In calculations.ts
//     `"universal"` means "slot cleared to no polarity" (full drain, no aura
//     doubling), whereas `"any"` is the matches-everything forma (half drain,
//     doubled aura) — which is what an Aya-forma'd slot actually does.
//
// Caution on `polarity_match === 2`: it means the slot polarity satisfies the
// mod's polarity, NOT that they're equal. An "any" slot (code 9) matches every
// mod, so it also reports `polarity_match === 2` — which is how code 9 was
// previously mis-read as zenurik (a zenurik mod sitting in an "any" slot looked
// like a zenurik match). Confirmed via Corrosive Projection (naramon) sitting
// in a code-9 slot with its aura capacity doubled.
//
// Codes 4, 6, 7, 8 are not yet observed; zenurik / unairu / umbra mappings
// remain unknown. Add them once a build with a confirmed match surfaces.
const OVERFRAME_POLARITY_CODE_MAP: Record<number, Polarity | undefined> = {
  0: undefined,
  1: "madurai",
  2: "vazarin",
  3: "naramon",
  5: "penjaga",
  9: "any",
}

/** Map an Overframe polarity code to our `Polarity`, or `undefined` for the
 *  "none" code (0) and any code not yet observed. */
export function mapOverframePolarity(code: number): Polarity | undefined {
  return OVERFRAME_POLARITY_CODE_MAP[code]
}
