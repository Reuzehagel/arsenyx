import { describe, expect, it } from "vitest"

import { parseStatText } from "./stat-text"

// These cases come from the actual arcane + mod corpus and cover the
// parsing rules that are painful to regress silently: unclosed DT_*_COLOR
// spans, per-line activeToken reset, `\\n` vs <LINE_SEPARATOR> as breaks,
// and residual <ENERGY>/<DT_SLASH> stripping.

describe("parseStatText", () => {
  it("colors element name + trailing 'Resistance' as one phrase", () => {
    // Toxin Resistance mods: only the noun phrase should carry the color.
    const segs = parseStatText("<DT_POISON_COLOR>Toxin Resistance")
    expect(segs).toEqual([
      { kind: "dt", token: "DT_POISON_COLOR", text: "Toxin Resistance" },
    ])
  })

  it("colors 'Heat Status' but leaves the rest of the clause plain", () => {
    // The unclosed span nominally carries through end-of-line; the renderer
    // narrows it to the noun phrase. Parser keeps the raw segment text;
    // narrowing happens in <StatText>, so here we just check the segment
    // boundaries are correct.
    const segs = parseStatText("<DT_FIRE_COLOR>Heat Status effect on enemies")
    expect(segs).toEqual([
      {
        kind: "dt",
        token: "DT_FIRE_COLOR",
        text: "Heat Status effect on enemies",
      },
    ])
  })

  it("captures the full span when there's no trailing keyword", () => {
    // "Electricity on Bullet Jump" — no Status/Damage/Resistance suffix,
    // so the renderer will color just "Electricity" and leave the rest.
    const segs = parseStatText(
      "<DT_ELECTRICITY_COLOR>Electricity on Bullet Jump",
    )
    expect(segs).toEqual([
      {
        kind: "dt",
        token: "DT_ELECTRICITY_COLOR",
        text: "Electricity on Bullet Jump",
      },
    ])
  })

  it("resets the active DT token at <LINE_SEPARATOR>", () => {
    // Critical: unclosed spans must NOT bleed across line breaks.
    const segs = parseStatText(
      "<DT_FIRE_COLOR>Heat Damage<LINE_SEPARATOR>plain second line",
    )
    expect(segs).toEqual([
      { kind: "dt", token: "DT_FIRE_COLOR", text: "Heat Damage" },
      { kind: "br" },
      { kind: "text", text: "plain second line" },
    ])
  })

  it("resets the active DT token at literal \\n", () => {
    const segs = parseStatText("<DT_VIRAL_COLOR>Viral\\nplain")
    expect(segs).toEqual([
      { kind: "dt", token: "DT_VIRAL_COLOR", text: "Viral" },
      { kind: "br" },
      { kind: "text", text: "plain" },
    ])
  })

  it("treats <br> as a line break (ability descriptions use it)", () => {
    const segs = parseStatText("first line<br>second line")
    expect(segs).toEqual([
      { kind: "text", text: "first line" },
      { kind: "br" },
      { kind: "text", text: "second line" },
    ])
  })

  it("strips residual non-color tags like <ENERGY>", () => {
    // <ENERGY> isn't a DT_ token, so it falls through to the residual-tag
    // cleanup and gets stripped from the surrounding plain segment.
    const segs = parseStatText("with <ENERGY>energy")
    expect(segs).toEqual([{ kind: "text", text: "with energy" }])
  })

  it("splits at DT_SLASH but doesn't activate a color span", () => {
    // DT_SLASH matches the DT_TOKEN_PATTERN (split), but without _COLOR
    // it doesn't set activeToken — so both sides render as plain text.
    const segs = parseStatText("Deal <DT_SLASH>damage")
    expect(segs).toEqual([
      { kind: "text", text: "Deal " },
      { kind: "text", text: "damage" },
    ])
  })

  it("handles a plain string with no tokens", () => {
    const segs = parseStatText("On Critical Hit: 30% chance for +15% Fire Rate")
    expect(segs).toEqual([
      { kind: "text", text: "On Critical Hit: 30% chance for +15% Fire Rate" },
    ])
  })

  it("handles multiple DT spans on one line", () => {
    const segs = parseStatText("<DT_FIRE_COLOR>Heat and <DT_FREEZE_COLOR>Cold")
    expect(segs).toEqual([
      { kind: "dt", token: "DT_FIRE_COLOR", text: "Heat and " },
      { kind: "dt", token: "DT_FREEZE_COLOR", text: "Cold" },
    ])
  })

  it("treats bare DT_SLASH as a stripped tag, not an active color", () => {
    // DT_SLASH has no _COLOR suffix — it's a damage-type symbol, not a
    // color span. Text after it should stay plain.
    const segs = parseStatText("<DT_SLASH>Slash damage")
    expect(segs).toEqual([{ kind: "text", text: "Slash damage" }])
  })

  // DE's pipe placeholders (|DURATION|, |DAMAGE|, …) are filled in by the
  // live game; our static data keeps them literal, so they're stripped
  // along with whatever glue character they're fused to.

  it("strips a bare |TOKEN| placeholder", () => {
    // Sirius & Orion's 4th ability. Stripping is lossy here — the
    // placeholder stands in for a real damage type.
    const segs = parseStatText(
      "inflict colossal collateral |DAMAGE_TYPE| damage",
    )
    expect(segs).toEqual([
      { kind: "text", text: "inflict colossal collateral damage" },
    ])
  })

  it("swallows the '%' and 's' units glued to placeholders", () => {
    // A naive strip would leave "by % for s". The trailing space survives
    // on purpose — it still separates this segment from the next one.
    const segs = parseStatText(
      "slows their movement by |SLOW|% for |DURATION|s",
    )
    expect(segs).toEqual([
      { kind: "text", text: "slows their movement by for " },
    ])
  })

  it("swallows a leading 'x' multiplier", () => {
    const segs = parseStatText("Deal x|DAMAGE| Damage to incapacitated enemies")
    expect(segs).toEqual([
      { kind: "text", text: "Deal Damage to incapacitated enemies" },
    ])
  })

  it("swallows a leading '+'", () => {
    const segs = parseStatText(
      "Attacks have an additional +|PUNCH_THROUGH| Punch Through.",
    )
    expect(segs).toEqual([
      { kind: "text", text: "Attacks have an additional Punch Through." },
    ])
  })

  it("swallows a trailing 'x' stack multiplier", () => {
    // Health Conversion (Tau) — three placeholders, three glue forms.
    const segs = parseStatText(
      "Health Orbs grant |ARMOUR| Armor, stacking up to |STACKS|x. Taking damage will consume a stack after |DURATION|s.",
    )
    expect(segs).toEqual([
      {
        kind: "text",
        text: "Health Orbs grant Armor, stacking up to. Taking damage will consume a stack after.",
      },
    ])
  })

  it("trims the space left by a line-initial placeholder", () => {
    const segs = parseStatText("|CHANCE|% Damage Reduction on AOE")
    expect(segs).toEqual([{ kind: "text", text: "Damage Reduction on AOE" }])
  })

  it("doesn't eat the tail of a word fused to a placeholder", () => {
    // The leading-'x' rule must not fire on the 'x' of "Max".
    const segs = parseStatText("up to Max|PERCENT|% strength")
    expect(segs).toEqual([{ kind: "text", text: "up to Max strength" }])
  })
})
