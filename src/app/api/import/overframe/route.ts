import { NextResponse } from "next/server"

import { encodeBuild } from "@/lib/build-codec"
import { createBaseBuildState } from "@/lib/builds/layout"
import { importOverframeBuild } from "@/lib/overframe"
import { applyOverframeImportToBuildState } from "@/lib/overframe/apply"
import { getCategoryConfig, isValidCategory } from "@/lib/warframe"
import { getFullItem } from "@/lib/warframe/items"
import { getModsForItem } from "@/lib/warframe/mods"
import type { BrowseCategory } from "@/lib/warframe/types"

export const runtime = "nodejs"

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { url?: string; encodeBuild?: boolean }
    const url = body?.url
    const wantEncodedBuild = body?.encodeBuild === true

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "Missing required field: url" },
        { status: 400 },
      )
    }

    const result = await importOverframeBuild(url)

    if (wantEncodedBuild) {
      const matched = result.item.matched

      if (!matched?.uniqueName || !matched.category) {
        return NextResponse.json({
          ...result,
          build: null,
          createUrl: null,
          applyWarnings: [],
          error: "Unable to encode build: item not matched",
        })
      }

      if (!isValidCategory(matched.category)) {
        return NextResponse.json({
          ...result,
          build: null,
          createUrl: null,
          applyWarnings: [],
          error: `Unable to encode build: unsupported category '${matched.category}'`,
        })
      }

      const category = matched.category as BrowseCategory
      const fullItem = getFullItem(category, matched.uniqueName)

      if (!fullItem) {
        const categoryLabel = getCategoryConfig(category)?.label ?? category
        return NextResponse.json({
          ...result,
          build: null,
          createUrl: null,
          applyWarnings: [],
          error: `Unable to encode build: item not found in ${categoryLabel}`,
        })
      }

      const compatibleMods = getModsForItem(fullItem)
      const base = createBaseBuildState(fullItem, category)
      const applied = applyOverframeImportToBuildState(
        base,
        result,
        compatibleMods,
      )

      // Prefer the Overframe page title as the build name when present.
      if (result.source.pageTitle && !applied.nextState.buildName) {
        applied.nextState.buildName = result.source.pageTitle
      }

      const build = encodeBuild(applied.nextState)
      const createUrl = `/create?build=${encodeURIComponent(build)}`

      return NextResponse.json({
        ...result,
        build,
        createUrl,
        applyWarnings: applied.warnings,
      })
    }

    // If the URL was invalid we still return 200 with warnings, so client can show message.
    return NextResponse.json(result)
  } catch (err) {
    return NextResponse.json(
      {
        error: "Failed to import Overframe build",
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 500 },
    )
  }
}
