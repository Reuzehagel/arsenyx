import { describe, it, expect, mock, beforeEach } from "bun:test"

// Mock getServerSession before importing the module under test
const mockGetServerSession = mock()

mock.module("@/lib/auth", () => ({
  getServerSession: mockGetServerSession,
}))

// Import after mocking
const { requireAuth } = await import("../auth-helpers")

beforeEach(() => {
  mockGetServerSession.mockReset()
})

describe("requireAuth", () => {
  it("returns error when session is null", async () => {
    mockGetServerSession.mockResolvedValue(null)

    const result = await requireAuth("vote")

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("You must be signed in to vote")
    }
  })

  it("returns error when session has no user", async () => {
    mockGetServerSession.mockResolvedValue({ user: null })

    const result = await requireAuth("save a build")

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("You must be signed in to save a build")
    }
  })

  it("returns error when user has no id", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: undefined } })

    const result = await requireAuth("delete a build")

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toBe("You must be signed in to delete a build")
    }
  })

  it("returns user ID on valid session", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "user-123" } })

    const result = await requireAuth("vote")

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).toBe("user-123")
    }
  })

  it("includes the action name in the error message", async () => {
    mockGetServerSession.mockResolvedValue(null)

    const result = await requireAuth("create an organization")

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error).toContain("create an organization")
    }
  })
})
