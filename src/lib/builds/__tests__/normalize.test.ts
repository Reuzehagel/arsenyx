import { beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))

const mockBuildFindUnique = mock()
const mockBuildFindMany = mock()
const mockOrganizationFindUnique = mock()
const mockIsOrgMember = mock()

mock.module("@/lib/db", () => ({
  prisma: {
    build: {
      findUnique: mockBuildFindUnique,
      findMany: mockBuildFindMany,
    },
    organization: {
      findUnique: mockOrganizationFindUnique,
    },
  },
}))

mock.module("@/lib/db/organizations", () => ({
  isOrgMember: mockIsOrgMember,
}))

const { BuildDraftError, normalizeBuildDraftForPersistence } =
  await import("../normalize")

function rhinoDraft(organizationSlug: string | null) {
  return {
    name: "Rhino",
    itemUniqueName: "/Lotus/Powersuits/Rhino/Rhino",
    itemCategory: "warframes",
    organizationSlug,
    build: {
      hasReactor: true,
      slots: [],
    },
  }
}

beforeEach(() => {
  mockBuildFindUnique.mockReset()
  mockBuildFindMany.mockReset()
  mockOrganizationFindUnique.mockReset()
  mockIsOrgMember.mockReset()
  mockBuildFindMany.mockResolvedValue([])
})

describe("normalizeBuildDraftForPersistence", () => {
  it("rejects organization re-homing by a non-owner editor", async () => {
    mockBuildFindUnique.mockResolvedValue({
      id: "build-1",
      userId: "owner-1",
      organizationId: "org-a",
    })

    await expect(
      normalizeBuildDraftForPersistence(
        {
          userId: "member-1",
          isBanned: false,
        },
        rhinoDraft(null),
        { existingBuildId: "build-1" },
      ),
    ).rejects.toMatchObject({
      code: "ORGANIZATION_REHOME_DENIED",
      status: 403,
    })
  })

  it("allows a non-owner editor to keep the existing organization", async () => {
    mockBuildFindUnique.mockResolvedValue({
      id: "build-1",
      userId: "owner-1",
      organizationId: "org-a",
    })
    mockOrganizationFindUnique.mockResolvedValue({
      id: "org-a",
      slug: "org-a",
    })
    mockIsOrgMember.mockResolvedValue(true)

    const normalized = await normalizeBuildDraftForPersistence(
      {
        userId: "member-1",
        isBanned: false,
      },
      rhinoDraft("org-a"),
      { existingBuildId: "build-1" },
    )

    expect(normalized.organizationId).toBe("org-a")
  })

  it("allows the build owner to move a build to an organization they belong to", async () => {
    mockBuildFindUnique.mockResolvedValue({
      id: "build-1",
      userId: "owner-1",
      organizationId: "org-a",
    })
    mockOrganizationFindUnique.mockResolvedValue({
      id: "org-b",
      slug: "org-b",
    })
    mockIsOrgMember.mockResolvedValue(true)

    const normalized = await normalizeBuildDraftForPersistence(
      {
        userId: "owner-1",
        isBanned: false,
      },
      rhinoDraft("org-b"),
      { existingBuildId: "build-1" },
    )

    expect(normalized.organizationId).toBe("org-b")
  })

  it("uses BuildDraftError for authorization failures", async () => {
    mockBuildFindUnique.mockResolvedValue({
      id: "build-1",
      userId: "owner-1",
      organizationId: "org-a",
    })

    await expect(
      normalizeBuildDraftForPersistence(
        {
          userId: "member-1",
          isBanned: false,
        },
        rhinoDraft(null),
        { existingBuildId: "build-1" },
      ),
    ).rejects.toBeInstanceOf(BuildDraftError)
  })
})
