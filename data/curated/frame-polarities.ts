/**
 * Curated per-frame polarity overrides — a stopgap for frames whose wiki
 * `Module:Warframes/data` entry is missing or incomplete, so our build can't
 * source polarities from the wiki yet. Values are wiki-verified and keyed by
 * the cleaned frame name. The wiki always wins when it has data; these only
 * fill the gaps (see `mergeFrame`).
 *
 * Polarity names are lowercase, matching `normalizePolarity` output
 * ("madurai", "vazarin", "naramon", "zenurik", "unairu", "penjaga", "umbra").
 *
 * Sirius & Orion (Update 43) ships as a twin-frame with two switchable forms
 * that have SEPARATE upgrade menus — including different aura polarities
 * (verified on wiki.warframe.com/w/Sirius_and_Orion: Sirius aura = Vazarin,
 * Orion aura = Naramon). The wiki data module hasn't catalogued it yet, so
 * both DE rows come through unmatched with empty polarities. We curate the
 * (high-confidence) aura polarities here; the 8 mod-slot polarity positions
 * aren't curated — they fill in automatically once the wiki module lists them.
 */

export interface FramePolarityOverride {
  /** Aura slot polarity (single value, or array for multi-aura frames). */
  auraPolarity?: string | string[]
  /** 8 mod-slot polarities, positional. Omit when unknown (don't guess). */
  polarities?: readonly string[]
  /** Exilus slot polarity. */
  exilusPolarity?: string
}

export const FRAME_POLARITY_OVERRIDES: Record<string, FramePolarityOverride> = {
  // Sirius controls the primary form (uniqueName .../SiriusSuit).
  "Sirius & Orion": { auraPolarity: "vazarin" },
  // Orion is the secondary form (.../OrionSuit), named "Orion & Sirius".
  "Orion & Sirius": { auraPolarity: "naramon" },
}
