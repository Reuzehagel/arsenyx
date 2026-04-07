import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"

import {
  getJsonBodyErrorResponse,
  jsonError,
  parseJsonBody,
  serializeBuildResponse,
} from "@/app/api/v1/_helpers"
import { requireApiKey } from "@/lib/auth/api-keys"
import {
  buildStateToDraftPayload,
  createBaseBuildState,
  getBuildDraftErrorResponse,
  normalizeBuildDraftForPersistence,
} from "@/lib/builds"
import { createBuild } from "@/lib/db/builds"
import { applyOverframeImportToBuildState } from "@/lib/overframe/apply"
import { importOverframeBuild } from "@/lib/overframe/import"
import { preserveOverframeLineBreaks } from "@/lib/overframe/markdown"
import { getFullItem } from "@/lib/warframe/items"
import { getModsForItem } from "@/lib/warframe/mods"
import type { BrowseCategory } from "@/lib/warframe/types"

export const runtime = "nodejs"

const OverframeImportSavePayloadSchema = z
  .object({
    url: z.string().trim().min(1),
    visibility: z.enum(["PUBLIC", "UNLISTED", "PRIVATE"]).optional(),
    organizationSlug: z.string().trim().min(1).nullable().optional(),
    nameOverride: z.string().trim().min(1).nullable().optional(),
    description: z.string().nullable().optional(),
    guide: z
      .object({
        summary: z.string().max(400).nullable().optional(),
        description: z.string().nullable().optional(),
      })
      .strict()
      .optional(),
    partnerBuildSlugs: z.array(z.string().trim().min(1)).max(10).optional(),
  })
  .strict()

function hasOwn<T extends object, K extends PropertyKey>(
  value: T,
  key: K,
): value is T & Record<K, unknown> {
  return Object.prototype.hasOwnProperty.call(value, key)
}

function normalizeImportedText(value: string | null | undefined) {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

function getGuideDefaults(
  guide: z.infer<typeof OverframeImportSavePayloadSchema>["guide"],
  importResult: Awaited<ReturnType<typeof importOverframeBuild>>,
) {
  const sourceSummary = normalizeImportedText(
    importResult.source.pageDescription,
  )
  const sourceGuideDescription = normalizeImportedText(
    importResult.source.guideDescription,
  )

  return {
    summary:
      guide && hasOwn(guide, "summary")
        ? guide.summary
        : sourceSummary?.slice(0, 400),
    description:
      guide && hasOwn(guide, "description")
        ? guide.description
        : sourceGuideDescription
          ? preserveOverframeLineBreaks(sourceGuideDescription)
          : sourceGuideDescription,
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireApiKey(request, "build:write")
  if (!auth.success) {
    return jsonError(auth.error.status, auth.error.code, auth.error.message)
  }

  try {
    const rawBody = await parseJsonBody(request)
    const parsedBody = OverframeImportSavePayloadSchema.safeParse(rawBody)
    if (!parsedBody.success) {
      const issue = parsedBody.error.issues[0]
      return jsonError(
        422,
        "INVALID_IMPORT_REQUEST",
        issue?.message ?? "Invalid import request",
      )
    }

    const importResult = await importOverframeBuild(parsedBody.data.url)
    const matchedItem = importResult.item.matched

    if (!matchedItem?.uniqueName || !matchedItem.category) {
      return jsonError(
        422,
        "OVERFRAME_ITEM_NOT_RESOLVED",
        "The Overframe item could not be resolved",
        {
          field: "url",
          extras: { warnings: importResult.warnings },
        },
      )
    }

    const category = matchedItem.category as BrowseCategory
    const fullItem = getFullItem(category, matchedItem.uniqueName)
    if (!fullItem) {
      return jsonError(
        422,
        "ITEM_NOT_FOUND",
        "Imported item was resolved but is not available in the codex",
        {
          field: "url",
          extras: { warnings: importResult.warnings },
        },
      )
    }

    const compatibleMods = getModsForItem(fullItem)
    const baseState = createBaseBuildState(fullItem, category)
    const applied = applyOverframeImportToBuildState(
      baseState,
      importResult,
      compatibleMods,
    )

    const draftPayload = buildStateToDraftPayload({
      name:
        parsedBody.data.nameOverride ??
        importResult.source.pageTitle ??
        `${fullItem.name} Build`,
      description: hasOwn(parsedBody.data, "description")
        ? parsedBody.data.description
        : normalizeImportedText(importResult.source.pageDescription),
      visibility: parsedBody.data.visibility,
      organizationSlug: parsedBody.data.organizationSlug ?? null,
      guide: getGuideDefaults(parsedBody.data.guide, importResult),
      partnerBuildSlugs: parsedBody.data.partnerBuildSlugs,
      buildState: applied.nextState,
    })

    const normalized = await normalizeBuildDraftForPersistence(
      {
        userId: auth.data.userId,
        isBanned: auth.data.isBanned,
      },
      draftPayload,
    )

    const build = await createBuild(auth.data.userId, {
      itemUniqueName: normalized.itemUniqueName,
      itemCategory: normalized.itemCategory,
      name: normalized.name,
      description: normalized.description,
      visibility: normalized.visibility,
      buildData: normalized.buildData,
      guideSummary: normalized.guideSummary ?? undefined,
      guideDescription: normalized.guideDescription ?? undefined,
      partnerBuildIds: normalized.partnerBuildIds,
      organizationId: normalized.organizationId ?? undefined,
    })

    return NextResponse.json(
      {
        ...serializeBuildResponse(build),
        warnings: [...importResult.warnings, ...applied.warnings],
      },
      {
        status: 201,
        headers: {
          Location: `/builds/${build.slug}`,
        },
      },
    )
  } catch (error) {
    const jsonBodyError = getJsonBodyErrorResponse(error)
    if (jsonBodyError) {
      return jsonBodyError
    }

    const draftError = getBuildDraftErrorResponse(error)
    if (draftError) {
      return NextResponse.json(draftError.body, { status: draftError.status })
    }

    console.error("Failed to import Overframe build via API:", error)
    return jsonError(500, "INTERNAL_ERROR", "Failed to import Overframe build")
  }
}
