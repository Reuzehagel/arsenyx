import type { BuildVisibility } from "@prisma/client"
import { NextResponse, type NextRequest } from "next/server"

export interface BuildApiResponseInput {
  id: string
  slug: string
  name: string
  visibility: BuildVisibility
  updatedAt: Date
  item: {
    uniqueName: string
    browseCategory: string
    name: string
  }
  organization: {
    id: string
    name: string
    slug: string
  } | null
}

export class JsonBodyError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message)
    this.name = "JsonBodyError"
  }
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  options?: {
    field?: string
    extras?: Record<string, unknown>
  },
) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
        ...(options?.field ? { field: options.field } : {}),
      },
      ...(options?.extras ?? {}),
    },
    { status },
  )
}

export async function parseJsonBody(request: NextRequest): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? ""
  if (!contentType.includes("application/json")) {
    throw new JsonBodyError(
      400,
      "INVALID_CONTENT_TYPE",
      "Content-Type must be application/json",
    )
  }

  try {
    return await request.json()
  } catch {
    throw new JsonBodyError(
      400,
      "INVALID_JSON",
      "Request body must be valid JSON",
    )
  }
}

export function getJsonBodyErrorResponse(error: unknown) {
  if (!(error instanceof JsonBodyError)) {
    return null
  }

  return jsonError(error.status, error.code, error.message)
}

export function serializeBuildResponse(build: BuildApiResponseInput) {
  return {
    id: build.id,
    slug: build.slug,
    url: `/builds/${build.slug}`,
    name: build.name,
    visibility: build.visibility,
    item: {
      uniqueName: build.item.uniqueName,
      category: build.item.browseCategory,
      name: build.item.name,
    },
    organization: build.organization
      ? {
          id: build.organization.id,
          name: build.organization.name,
          slug: build.organization.slug,
        }
      : null,
    updatedAt: build.updatedAt.toISOString(),
  }
}
