import { NextResponse, type NextRequest } from "next/server"

import {
  getJsonBodyErrorResponse,
  jsonError,
  parseJsonBody,
  serializeBuildResponse,
} from "@/app/api/v1/_helpers"
import { requireApiKey } from "@/lib/auth/api-keys"
import {
  getBuildDraftErrorResponse,
  normalizeBuildDraftForPersistence,
} from "@/lib/builds"
import { createBuild } from "@/lib/db/builds"

export const runtime = "nodejs"

export async function POST(request: NextRequest) {
  const auth = await requireApiKey(request, "build:write")
  if (!auth.success) {
    return jsonError(auth.error.status, auth.error.code, auth.error.message)
  }

  try {
    const body = await parseJsonBody(request)
    const normalized = await normalizeBuildDraftForPersistence(
      {
        userId: auth.data.userId,
        isBanned: auth.data.isBanned,
      },
      body,
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

    return NextResponse.json(serializeBuildResponse(build), {
      status: 201,
      headers: {
        Location: `/builds/${build.slug}`,
      },
    })
  } catch (error) {
    const jsonBodyError = getJsonBodyErrorResponse(error)
    if (jsonBodyError) {
      return jsonBodyError
    }

    const draftError = getBuildDraftErrorResponse(error)
    if (draftError) {
      return NextResponse.json(draftError.body, { status: draftError.status })
    }

    console.error("Failed to create build via API:", error)
    return jsonError(500, "INTERNAL_ERROR", "Failed to create build")
  }
}
