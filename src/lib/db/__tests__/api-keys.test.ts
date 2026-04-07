import { beforeEach, describe, expect, it, mock } from "bun:test"

mock.module("server-only", () => ({}))

const mockCount = mock()
const mockCreate = mock()
const mockFindMany = mock()
const mockUpdateMany = mock()
const mockFindUnique = mock()
const mockUpdate = mock()
const mockUpsert = mock()
const mockRateLimitDeleteMany = mock()
const mockTransaction = mock()
const mockQueryRaw = mock()

mock.module("@/lib/db", () => ({
  prisma: {
    $transaction: mockTransaction,
    apiKey: {
      count: mockCount,
      create: mockCreate,
      findMany: mockFindMany,
      updateMany: mockUpdateMany,
      findUnique: mockFindUnique,
      update: mockUpdate,
    },
    apiKeyRateLimitWindow: {
      upsert: mockUpsert,
      deleteMany: mockRateLimitDeleteMany,
    },
  },
}))

const {
  ApiKeyRateLimitExceededError,
  consumeApiKeyRateLimit,
  createApiKey,
  findApiKeyByRawToken,
  getApiKeyPrefix,
  hashApiKey,
} = await import("../api-keys")

beforeEach(() => {
  mockCount.mockReset()
  mockCreate.mockReset()
  mockFindMany.mockReset()
  mockUpdateMany.mockReset()
  mockFindUnique.mockReset()
  mockUpdate.mockReset()
  mockUpsert.mockReset()
  mockRateLimitDeleteMany.mockReset()
  mockTransaction.mockReset()
  mockQueryRaw.mockReset()
  mockQueryRaw.mockResolvedValue([])
  mockRateLimitDeleteMany.mockResolvedValue({ count: 0 })
  mockTransaction.mockImplementation(
    (operation: ((tx: unknown) => unknown) | Promise<unknown>[]) => {
      if (typeof operation === "function") {
        return operation({
          $queryRaw: mockQueryRaw,
          apiKey: {
            count: mockCount,
            create: mockCreate,
          },
        })
      }

      return Promise.all(operation)
    },
  )
})

describe("api key helpers", () => {
  it("hashes tokens deterministically and keeps the visible prefix", () => {
    const token = "ars_live_exampletoken"

    expect(hashApiKey(token)).toBe(hashApiKey(token))
    expect(getApiKeyPrefix(token)).toBe("ars_live_example")
  })

  it("creates a new api key with a stored hash", async () => {
    mockCount.mockResolvedValue(0)
    mockCreate.mockImplementation(async ({ data }: { data: any }) => ({
      id: "key-1",
      name: data.name,
      keyPrefix: data.keyPrefix,
      scopes: data.scopes,
      rateLimit: data.rateLimit,
      isActive: true,
      createdAt: new Date("2026-04-06T00:00:00.000Z"),
      expiresAt: data.expiresAt ?? null,
      lastUsedAt: null,
    }))

    const result = await createApiKey("user-1", {
      name: "CI uploader",
    })

    expect(result.token.startsWith("ars_live_")).toBe(true)
    expect(result.apiKey.name).toBe("CI uploader")
    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    expect(mockCreate).toHaveBeenCalledTimes(1)
    expect(mockCreate.mock.calls[0]?.[0]?.data?.key).not.toBe(result.token)
  })

  it("enforces the active api key limit inside the issuance transaction", async () => {
    mockCount.mockResolvedValue(10)

    await expect(
      createApiKey("user-1", {
        name: "Too many",
      }),
    ).rejects.toThrow("You can only have 10 active API keys")

    expect(mockTransaction).toHaveBeenCalledTimes(1)
    expect(mockQueryRaw).toHaveBeenCalledTimes(1)
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it("finds and verifies a token by its raw value", async () => {
    const token = "ars_live_exampletoken"
    const hashedToken = hashApiKey(token)

    mockFindUnique.mockResolvedValue({
      id: "key-1",
      userId: "user-1",
      name: "CI uploader",
      key: hashedToken,
      keyPrefix: getApiKeyPrefix(token),
      scopes: ["build:write"],
      rateLimit: 60,
      isActive: true,
      createdAt: new Date("2026-04-06T00:00:00.000Z"),
      expiresAt: null,
      lastUsedAt: null,
      user: {
        id: "user-1",
        isBanned: false,
      },
    })

    const result = await findApiKeyByRawToken(token)

    expect(result?.id).toBe("key-1")
    expect(result?.user.id).toBe("user-1")
  })

  it("throws when the per-hour rate limit is exceeded", async () => {
    mockUpsert.mockResolvedValue({
      requestCount: 61,
    })

    await expect(consumeApiKeyRateLimit("key-1", 60)).rejects.toBeInstanceOf(
      ApiKeyRateLimitExceededError,
    )
  })

  it("prunes old rate-limit windows while consuming a request", async () => {
    mockUpsert.mockResolvedValue({
      requestCount: 1,
    })

    await consumeApiKeyRateLimit(
      "key-1",
      60,
      new Date("2026-04-07T13:45:00.000Z"),
    )

    expect(mockRateLimitDeleteMany).toHaveBeenCalledTimes(1)
    expect(
      mockRateLimitDeleteMany.mock.calls[0]?.[0]?.where?.windowStart?.lt,
    ).toEqual(new Date("2026-04-05T13:00:00.000Z"))
  })
})
