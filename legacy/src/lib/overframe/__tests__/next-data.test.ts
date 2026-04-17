import { describe, expect, it } from "bun:test"

import { extractOverframeDataFromHtml } from "../next-data"

describe("extractOverframeDataFromHtml", () => {
  it("extracts Overframe metadata and Helminth ability tuples", () => {
    const html = `
      <script id="__NEXT_DATA__" type="application/json">
        {
          "props": {
            "pageProps": {
              "data": {
                "title": "(READ DESCRIPTION) Profit Taker META SICARUS BUILD",
                "description": "Fallback guide body"
              },
              "pageDescription": "(READ DESCRIPTION) Profit Taker META SICARUS BUILD - 5 Forma Sicarus Prime build by UnOriginalGN - Updated for Warframe 39.0",
              "guideMarkdown": "EVO II: Feigned Retreat +40 Base Damage\\n\\nEVO III: Extended Volley +12 Mag Size",
              "buildState": {
                "helminthAbility": [3, "/Lotus/Powersuits/PowersuitAbilities/LightAbility"]
              }
            }
          }
        }
      </script>
    `

    const result = extractOverframeDataFromHtml(html, {
      url: "https://overframe.gg/build/771300/",
    })

    expect(result.pageTitle).toBe(
      "(READ DESCRIPTION) Profit Taker META SICARUS BUILD",
    )
    expect(result.pageDescription).toContain("5 Forma Sicarus Prime")
    expect(result.guideDescription).toContain("EVO II")
    expect(result.helminthAbility).toEqual({
      slotIndex: 3,
      uniqueName: "/Lotus/Powersuits/PowersuitAbilities/LightAbility",
    })
    expect(result.extractedKeys).toContain(
      "props.pageProps.buildState.helminthAbility",
    )
  })
})
