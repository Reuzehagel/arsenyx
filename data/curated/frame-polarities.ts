/**
 * Curated per-frame polarity overrides — for frames whose wiki
 * `Module:Warframes/data` entry is missing, incomplete, or (for twin-frames)
 * unsplittable, so our build can't source per-form polarities from the wiki.
 * Values are wiki-verified and keyed by the cleaned frame name. By default the
 * wiki wins when it has data and these only fill the gaps; an entry marked
 * `force` wins even over wiki data (see `mergeFrame`).
 *
 * Polarity names are lowercase, matching `normalizePolarity` output
 * ("madurai", "vazarin", "naramon", "zenurik", "unairu", "penjaga", "umbra").
 *
 * Sirius & Orion (Update 43) ships as a twin-frame with two switchable forms
 * that have SEPARATE upgrade menus — including different aura polarities
 * (verified on wiki.warframe.com/w/Sirius_and_Orion: Sirius aura = Vazarin,
 * Orion aura = Naramon). The wiki carries only ONE combined entry for the pair
 * ("Sirius & Orion") whose Polarities/AuraPolarity list both halves' slots
 * (aura markers inline) and can't be split back per-form — so left to the wiki
 * the primary form renders two aura slots and a doubled polarity bar. We
 * therefore `force` the curated per-form aura here; the 8 mod-slot polarity
 * positions stay uncurated (don't guess) until a per-form source exists.
 */

export interface FramePolarityOverride {
  /** Aura slot polarity (single value, or array for multi-aura frames). */
  auraPolarity?: string | string[]
  /** 8 mod-slot polarities, positional. Omit when unknown (don't guess). */
  polarities?: readonly string[]
  /** Exilus slot polarity. */
  exilusPolarity?: string
  /** Win over the wiki even when it has data. Needed for twin-frames whose
   *  single combined wiki entry can't be split into the two forms. */
  force?: boolean
}

export const FRAME_POLARITY_OVERRIDES: Record<string, FramePolarityOverride> = {
  // Sirius controls the primary form (uniqueName .../SiriusSuit). `force`: the
  // combined wiki entry can't be split per-form, so the curated aura wins.
  "Sirius & Orion": { auraPolarity: "vazarin", force: true },
  // Orion is the secondary form (.../OrionSuit), named "Orion & Sirius".
  "Orion & Sirius": { auraPolarity: "naramon", force: true },
}
