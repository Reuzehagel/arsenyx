import { beforeEach, describe, expect, it, mock } from "bun:test"

const mockRequireApiKey = mock()
const mockNormalizeBuildDraftForPersistence = mock()
const mockCreateBuild = mock()
const mockUpdateBuild = mock()
const mockFindBuildBySlug = mock()
const mockIsOrgMember = mock()

mock.module("@/lib/auth/api-keys", () => ({
  requireApiKey: mockRequireApiKey,
}))

mock.module("@/lib/builds", () => ({
  getBuildDraftErrorResponse: () => null,
  normalizeBuildDraftForPersistence: mockNormalizeBuildDraftForPersistence,
}))

mock.module("@/lib/db/builds", () => ({
  createBuild: mockCreateBuild,
  updateBuild: mockUpdateBuild,
}))

mock.module("@/lib/db", () => ({
  prisma: {
    build: {
      findUnique: mockFindBuildBySlug,
    },
  },
}))

mock.module("@/lib/db/organizations", () => ({
  isOrgMember: mockIsOrgMember,
}))

const { POST } = await import("../route")
const { PUT } = await import("../[slug]/route")

beforeEach(() => {
  mockRequireApiKey.mockReset()
  mockNormalizeBuildDraftForPersistence.mockReset()
  mockCreateBuild.mockReset()
  mockUpdateBuild.mockReset()
  mockFindBuildBySlug.mockReset()
  mockIsOrgMember.mockReset()
})

describe("POST /api/v1/builds", () => {
  it("creates a build and returns 201 with location header", async () => {
    mockRequireApiKey.mockResolvedValue({
      success: true,
      data: {
        userId: "user-1",
        apiKeyId: "key-1",
        isBanned: false,
      },
    })
    mockNormalizeBuildDraftForPersistence.mockResolvedValue({
      itemUniqueName: "/Lotus/Powersuits/Rhino/Rhino",
      itemCategory: "warframes",
      itemName: "Rhino",
      itemImageName: "rhino.png",
      name: "Rhino Tank",
      description: null,
      visibility: "PUBLIC",
      buildData: { hasReactor: true },
      organizationId: null,
      partnerBuildIds: [],
      guideSummary: null,
      guideDescription: null,
    })
    mockCreateBuild.mockResolvedValue({
      id: "build-1",
      slug: "abc123def4",
      name: "Rhino Tank",
      visibility: "PUBLIC",
      updatedAt: new Date("2026-04-06T12:00:00.000Z"),
      item: {
        uniqueName: "/Lotus/Powersuits/Rhino/Rhino",
        browseCategory: "warframes",
        name: "Rhino",
      },
      organization: null,
    })

    const response = await POST(
      new Request("http://localhost/api/v1/builds", {
        method: "POST",
        headers: {
          authorization: "Bearer ars_live_example",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Rhino Tank" }),
      }) as never,
    )

    expect(response.status).toBe(201)
    expect(response.headers.get("location")).toBe("/builds/abc123def4")
    expect(await response.json()).toEqual({
      id: "build-1",
      slug: "abc123def4",
      url: "/builds/abc123def4",
      name: "Rhino Tank",
      visibility: "PUBLIC",
      item: {
        uniqueName: "/Lotus/Powersuits/Rhino/Rhino",
        category: "warframes",
        name: "Rhino",
      },
      organization: null,
      updatedAt: "2026-04-06T12:00:00.000Z",
    })
  })

  it("returns auth failures directly", async () => {
    mockRequireApiKey.mockResolvedValue({
      success: false,
      error: {
        status: 401,
        code: "INVALID_API_KEY",
        message: "Invalid API key",
      },
    })

    const response = await POST(
      new Request("http://localhost/api/v1/builds", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }) as never,
    )

    expect(response.status).toBe(401)
    expect(await response.json()).toEqual({
      error: {
        code: "INVALID_API_KEY",
        message: "Invalid API key",
      },
    })
  })

  it("returns rate-limit auth failures directly", async () => {
    mockRequireApiKey.mockResolvedValue({
      success: false,
      error: {
        status: 429,
        code: "RATE_LIMIT_EXCEEDED",
        message: "API key rate limit of 60 requests per hour exceeded",
      },
    })

    const response = await POST(
      new Request("http://localhost/api/v1/builds", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({}),
      }) as never,
    )

    expect(response.status).toBe(429)
    expect(await response.json()).toEqual({
      error: {
        code: "RATE_LIMIT_EXCEEDED",
        message: "API key rate limit of 60 requests per hour exceeded",
      },
    })
  })
})

describe("PUT /api/v1/builds/:slug", () => {
  it("preserves null description so updates can clear it", async () => {
    mockRequireApiKey.mockResolvedValue({
      success: true,
      data: {
        userId: "user-1",
        apiKeyId: "key-1",
        isBanned: false,
      },
    })
    mockFindBuildBySlug.mockResolvedValue({
      id: "build-1",
      userId: "user-1",
      organizationId: null,
      itemUniqueName: "/Lotus/Powersuits/Rhino/Rhino",
      itemCategory: "warframes",
    })
    mockNormalizeBuildDraftForPersistence.mockResolvedValue({
      itemUniqueName: "/Lotus/Powersuits/Rhino/Rhino",
      itemCategory: "warframes",
      itemName: "Rhino",
      itemImageName: "rhino.png",
      name: "Rhino Tank",
      description: null,
      visibility: "PRIVATE",
      buildData: { hasReactor: true },
      organizationId: null,
      partnerBuildIds: [],
      guideSummary: null,
      guideDescription: null,
    })
    mockUpdateBuild.mockResolvedValue({
      id: "build-1",
      slug: "abc123def4",
      name: "Rhino Tank",
      visibility: "PRIVATE",
      updatedAt: new Date("2026-04-06T12:00:00.000Z"),
      item: {
        uniqueName: "/Lotus/Powersuits/Rhino/Rhino",
        browseCategory: "warframes",
        name: "Rhino",
      },
      organization: null,
    })

    const response = await PUT(
      new Request("http://localhost/api/v1/builds/abc123def4", {
        method: "PUT",
        headers: {
          authorization: "Bearer ars_live_example",
          "content-type": "application/json",
        },
        body: JSON.stringify({ name: "Rhino Tank", description: null }),
      }) as never,
      { params: Promise.resolve({ slug: "abc123def4" }) },
    )

    expect(response.status).toBe(200)
    expect(mockUpdateBuild.mock.calls[0]?.[2]?.description).toBeNull()
  })
})
