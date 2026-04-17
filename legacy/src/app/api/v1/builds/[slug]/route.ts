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
import { prisma } from "@/lib/db"
import { updateBuild } from "@/lib/db/builds"
import { isOrgMember } from "@/lib/db/organizations"

export const runtime = "nodejs"

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> },
) {
  const [auth, { slug }] = await Promise.all([
    requireApiKey(request, "build:write"),
    context.params,
  ])
  if (!auth.success) {
    return jsonError(auth.error.status, auth.error.code, auth.error.message)
  }

  try {
    const existingBuild = await prisma.build.findUnique({
      where: { slug },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        itemUniqueName: true,
        itemCategory: true,
      },
    })

    if (!existingBuild) {
      return jsonError(404, "BUILD_NOT_FOUND", "Build not found")
    }

    const canEdit =
      existingBuild.userId === auth.data.userId ||
      (existingBuild.organizationId
        ? await isOrgMember(existingBuild.organizationId, auth.data.userId)
        : false)

    if (!canEdit) {
      return jsonError(403, "BUILD_ACCESS_DENIED", "Build is not editable")
    }

    const body = await parseJsonBody(request)
    const normalized = await normalizeBuildDraftForPersistence(
      {
        userId: auth.data.userId,
        isBanned: auth.data.isBanned,
      },
      body,
      { existingBuildId: existingBuild.id },
    )

    if (
      normalized.itemUniqueName !== existingBuild.itemUniqueName ||
      normalized.itemCategory !== existingBuild.itemCategory
    ) {
      return jsonError(
        409,
        "ITEM_CHANGE_NOT_ALLOWED",
        "Build item cannot be changed by update",
      )
    }

    const build = await updateBuild(existingBuild.id, auth.data.userId, {
      name: normalized.name,
      description: normalized.description,
      visibility: normalized.visibility,
      buildData: normalized.buildData,
      organizationId: normalized.organizationId,
      guideSummary: normalized.guideSummary,
      guideDescription: normalized.guideDescription,
      partnerBuildIds: normalized.partnerBuildIds,
    })

    return NextResponse.json(serializeBuildResponse(build))
  } catch (error) {
    const jsonBodyError = getJsonBodyErrorResponse(error)
    if (jsonBodyError) {
      return jsonBodyError
    }

    const draftError = getBuildDraftErrorResponse(error)
    if (draftError) {
      return NextResponse.json(draftError.body, { status: draftError.status })
    }

    console.error("Failed to update build via API:", error)
    return jsonError(500, "INTERNAL_ERROR", "Failed to update build")
  }
}
