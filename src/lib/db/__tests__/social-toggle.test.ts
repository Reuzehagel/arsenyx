import { describe, it, expect, mock, beforeEach } from "bun:test"

// Mock prisma before importing module under test
const mockFindUnique = mock()
const mockDelete = mock()
const mockCreate = mock()
const mockFindMany = mock()
const mockTransaction = mock()
const mockBuildUpdate = mock()

mock.module("@/lib/db", () => ({
  prisma: {
    buildVote: {
      findUnique: mockFindUnique,
      delete: mockDelete,
      create: mockCreate,
      findMany: mockFindMany,
    },
    buildFavorite: {
      findUnique: mockFindUnique,
      delete: mockDelete,
      create: mockCreate,
      findMany: mockFindMany,
    },
    build: {
      update: mockBuildUpdate,
    },
    $transaction: mockTransaction,
  },
}))

const { toggleBuildSocialAction, getUserSocialStatusesForBuilds } =
  await import("../social-toggle")

beforeEach(() => {
  mockFindUnique.mockReset()
  mockDelete.mockReset()
  mockCreate.mockReset()
  mockFindMany.mockReset()
  mockTransaction.mockReset()
  mockBuildUpdate.mockReset()
})

// =============================================================================
// toggleBuildSocialAction
// =============================================================================

describe("toggleBuildSocialAction", () => {
  it("creates a record and increments count when no existing record", async () => {
    mockFindUnique.mockResolvedValue(null)
    mockTransaction.mockResolvedValue([
      { id: "new-vote", userId: "u1", buildId: "b1" },
      { voteCount: 5 },
    ])

    const result = await toggleBuildSocialAction(
      "u1",
      "b1",
      "buildVote",
      "voteCount",
    )

    expect(result.active).toBe(true)
    expect(result.count).toBe(5)
    expect(mockFindUnique).toHaveBeenCalledTimes(1)
    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })

  it("deletes a record and decrements count when existing record found", async () => {
    mockFindUnique.mockResolvedValue({ id: "existing-vote" })
    mockTransaction.mockResolvedValue([
      { id: "existing-vote" },
      { voteCount: 3 },
    ])

    const result = await toggleBuildSocialAction(
      "u1",
      "b1",
      "buildVote",
      "voteCount",
    )

    expect(result.active).toBe(false)
    expect(result.count).toBe(3)
    expect(mockTransaction).toHaveBeenCalledTimes(1)
  })

  it("works with favoriteCount field", async () => {
    mockFindUnique.mockResolvedValue(null)
    mockTransaction.mockResolvedValue([
      { id: "new-fav" },
      { favoriteCount: 10 },
    ])

    const result = await toggleBuildSocialAction(
      "u1",
      "b1",
      "buildFavorite",
      "favoriteCount",
    )

    expect(result.active).toBe(true)
    expect(result.count).toBe(10)
  })
})

// =============================================================================
// getUserSocialStatusesForBuilds
// =============================================================================

describe("getUserSocialStatusesForBuilds", () => {
  it("returns empty set for empty buildIds array", async () => {
    const result = await getUserSocialStatusesForBuilds("u1", [], "buildVote")

    expect(result.size).toBe(0)
    expect(mockFindMany).not.toHaveBeenCalled()
  })

  it("returns set of build IDs the user has acted on", async () => {
    mockFindMany.mockResolvedValue([
      { buildId: "b1" },
      { buildId: "b3" },
    ])

    const result = await getUserSocialStatusesForBuilds(
      "u1",
      ["b1", "b2", "b3"],
      "buildVote",
    )

    expect(result).toEqual(new Set(["b1", "b3"]))
    expect(mockFindMany).toHaveBeenCalledTimes(1)
  })

  it("works with buildFavorite table", async () => {
    mockFindMany.mockResolvedValue([{ buildId: "b2" }])

    const result = await getUserSocialStatusesForBuilds(
      "u1",
      ["b1", "b2"],
      "buildFavorite",
    )

    expect(result).toEqual(new Set(["b2"]))
  })
})
