import { beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))

const mockBuildFindUnique = mock()
const mockBuildCreate = mock()
const mockBuildUpdate = mock()
const mockGetFullItem = mock()
const mockIsOrgMember = mock()

mock.module("@/lib/db", () => ({
  prisma: {
    build: {
      findUnique: mockBuildFindUnique,
      create: mockBuildCreate,
      update: mockBuildUpdate,
    },
  },
}))

mock.module("@/lib/db/organizations", () => ({
  isOrgMember: mockIsOrgMember,
}))

mock.module("../organizations", () => ({
  isOrgMember: mockIsOrgMember,
}))

mock.module("./org-membership", () => ({
  isOrgMember: mockIsOrgMember,
}))

mock.module("../org-membership", () => ({
  isOrgMember: mockIsOrgMember,
}))

mock.module("@/lib/warframe/items", () => ({
  getFullItem: mockGetFullItem,
}))

const { createBuild, updateBuild } = await import("../builds")

beforeEach(() => {
  mockBuildFindUnique.mockReset()
  mockBuildCreate.mockReset()
  mockBuildUpdate.mockReset()
  mockGetFullItem.mockReset()
  mockIsOrgMember.mockReset()
})

describe("build persistence helpers", () => {
  it("strips undefined values before writing buildData JSON", async () => {
    mockBuildFindUnique.mockResolvedValue(null)
    mockGetFullItem.mockReturnValue({
      uniqueName: "/Lotus/Powersuits/Rhino/Rhino",
      name: "Rhino",
      imageName: undefined,
    })
    mockBuildCreate.mockImplementation(async ({ data }: { data: any }) => ({
      id: "build-1",
      slug: data.slug,
      name: data.name,
      description: data.description ?? null,
      visibility: data.visibility,
      buildData: data.buildData,
      voteCount: 0,
      favoriteCount: 0,
      viewCount: 0,
      createdAt: new Date("2026-04-06T12:00:00.000Z"),
      updatedAt: new Date("2026-04-06T12:00:00.000Z"),
      userId: data.userId,
      user: {
        id: data.userId,
        name: null,
        username: "arseny",
        image: null,
      },
      organization: null,
      buildGuide: null,
      partnerBuilds: [],
      itemUniqueName: data.itemUniqueName,
      itemName: data.itemName,
      itemImageName: data.itemImageName,
      itemCategory: data.itemCategory,
    }))

    await createBuild("user-1", {
      itemUniqueName: "/Lotus/Powersuits/Rhino/Rhino",
      itemCategory: "warframes",
      name: "Rhino",
      buildData: {
        itemUniqueName: "/Lotus/Powersuits/Rhino/Rhino",
        itemName: "Rhino",
        itemCategory: "warframes",
        itemImageName: undefined,
        hasReactor: true,
        auraSlots: [],
        exilusSlot: {
          id: "exilus-0",
          type: "exilus",
          innatePolarity: undefined,
        },
        normalSlots: [
          {
            id: "normal-0",
            type: "normal",
            innatePolarity: undefined,
          },
        ],
        arcaneSlots: [undefined],
        shardSlots: [undefined],
        baseCapacity: 60,
        currentCapacity: 60,
        formaCount: 0,
      } as never,
    })

    const storedBuildData = mockBuildCreate.mock.calls[0]?.[0]?.data?.buildData

    expect(Object.hasOwn(storedBuildData, "itemImageName")).toBe(false)
    expect(storedBuildData.auraSlots).toEqual([])
    expect(Object.hasOwn(storedBuildData.exilusSlot, "innatePolarity")).toBe(
      false,
    )
    expect(
      Object.hasOwn(storedBuildData.normalSlots[0], "innatePolarity"),
    ).toBe(false)
    expect(storedBuildData.arcaneSlots[0]).toBeNull()
    expect(storedBuildData.shardSlots[0]).toBeNull()
  })

  it("prevents org members from moving someone else's org build", async () => {
    mockBuildFindUnique.mockResolvedValue({
      userId: "owner-1",
      organizationId: "org-a",
    })
    mockIsOrgMember.mockResolvedValue(true)

    await expect(
      updateBuild("build-1", "member-1", {
        organizationId: null,
      }),
    ).rejects.toThrow(
      "Only the build owner can move a build between personal and organization ownership",
    )

    expect(mockBuildUpdate).not.toHaveBeenCalled()
  })
})
