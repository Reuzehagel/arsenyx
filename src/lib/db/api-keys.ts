import "server-only"
import { createHash, randomBytes } from "node:crypto"

import type { Prisma } from "@prisma/client"

import { prisma } from "@/lib/db"

const API_KEY_PREFIX = "ars_live_"
const API_KEY_SECRET_BYTES = 24
const API_KEY_PREFIX_LENGTH = 16

export const DEFAULT_API_KEY_SCOPE = "build:write"
export const DEFAULT_API_KEY_RATE_LIMIT = 60
export const MAX_ACTIVE_API_KEYS_PER_USER = 10
export const API_KEY_RATE_LIMIT_WINDOW_RETENTION_HOURS = 48

export interface CreateApiKeyInput {
  name: string
  expiresAt?: Date | null
  scopes?: string[]
  rateLimit?: number
}

export interface ApiKeyListItem {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  rateLimit: number
  isActive: boolean
  createdAt: Date
  expiresAt: Date | null
  lastUsedAt: Date | null
}

export interface CreatedApiKey {
  token: string
  apiKey: ApiKeyListItem
}

export interface ResolvedApiKey {
  id: string
  userId: string
  name: string
  keyPrefix: string
  scopes: string[]
  rateLimit: number
  isActive: boolean
  createdAt: Date
  expiresAt: Date | null
  lastUsedAt: Date | null
  user: {
    id: string
    isBanned: boolean
  }
}

export class ApiKeyRateLimitExceededError extends Error {
  constructor(
    public readonly rateLimit: number,
    public readonly resetAt: Date,
  ) {
    super(`API key rate limit of ${rateLimit} requests per hour exceeded`)
    this.name = "ApiKeyRateLimitExceededError"
  }
}

export function generateApiKeyToken(): string {
  const secret = randomBytes(API_KEY_SECRET_BYTES).toString("hex")
  return `${API_KEY_PREFIX}${secret}`
}

export function getApiKeyPrefix(token: string): string {
  return token.slice(0, API_KEY_PREFIX_LENGTH)
}

export function hashApiKey(token: string): string {
  return createHash("sha256").update(token).digest("hex")
}

function mapApiKeyListItem(apiKey: {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  rateLimit: number
  isActive: boolean
  createdAt: Date
  expiresAt: Date | null
  lastUsedAt: Date | null
}): ApiKeyListItem {
  return {
    id: apiKey.id,
    name: apiKey.name,
    keyPrefix: apiKey.keyPrefix,
    scopes: [...apiKey.scopes],
    rateLimit: apiKey.rateLimit,
    isActive: apiKey.isActive,
    createdAt: apiKey.createdAt,
    expiresAt: apiKey.expiresAt,
    lastUsedAt: apiKey.lastUsedAt,
  }
}

function getRateLimitWindowStart(date = new Date()): Date {
  const windowStart = new Date(date)
  windowStart.setUTCMinutes(0, 0, 0)
  return windowStart
}

async function createApiKeyInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  input: CreateApiKeyInput,
): Promise<CreatedApiKey> {
  await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`

  const activeKeyCount = await tx.apiKey.count({
    where: {
      userId,
      isActive: true,
    },
  })

  if (activeKeyCount >= MAX_ACTIVE_API_KEYS_PER_USER) {
    throw new Error(
      `You can only have ${MAX_ACTIVE_API_KEYS_PER_USER} active API keys`,
    )
  }

  const token = generateApiKeyToken()
  const apiKey = await tx.apiKey.create({
    data: {
      userId,
      name: input.name.trim(),
      key: hashApiKey(token),
      keyPrefix: getApiKeyPrefix(token),
      scopes:
        input.scopes && input.scopes.length > 0
          ? input.scopes
          : [DEFAULT_API_KEY_SCOPE],
      rateLimit: input.rateLimit ?? DEFAULT_API_KEY_RATE_LIMIT,
      expiresAt: input.expiresAt ?? null,
    },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      rateLimit: true,
      isActive: true,
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true,
    },
  })

  return {
    token,
    apiKey: mapApiKeyListItem(apiKey),
  }
}

export async function createApiKey(
  userId: string,
  input: CreateApiKeyInput,
): Promise<CreatedApiKey> {
  return prisma.$transaction((tx) =>
    createApiKeyInTransaction(tx, userId, input),
  )
}

export async function listApiKeysForUser(
  userId: string,
): Promise<ApiKeyListItem[]> {
  const apiKeys = await prisma.apiKey.findMany({
    where: { userId },
    select: {
      id: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      rateLimit: true,
      isActive: true,
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true,
    },
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  })

  return apiKeys.map(mapApiKeyListItem)
}

export async function revokeApiKey(
  userId: string,
  apiKeyId: string,
): Promise<void> {
  const result = await prisma.apiKey.updateMany({
    where: {
      id: apiKeyId,
      userId,
      isActive: true,
    },
    data: {
      isActive: false,
    },
  })

  if (result.count === 0) {
    throw new Error("API key not found")
  }
}

export async function findApiKeyByRawToken(
  rawToken: string,
): Promise<ResolvedApiKey | null> {
  const hashedToken = hashApiKey(rawToken)
  const apiKey = await prisma.apiKey.findUnique({
    where: {
      key: hashedToken,
    },
    select: {
      id: true,
      userId: true,
      name: true,
      keyPrefix: true,
      scopes: true,
      rateLimit: true,
      isActive: true,
      createdAt: true,
      expiresAt: true,
      lastUsedAt: true,
      user: {
        select: {
          id: true,
          isBanned: true,
        },
      },
    },
  })

  if (!apiKey) {
    return null
  }

  return {
    ...apiKey,
    expiresAt: apiKey.expiresAt ?? null,
    lastUsedAt: apiKey.lastUsedAt ?? null,
  }
}

export async function touchApiKeyLastUsedAt(apiKeyId: string): Promise<void> {
  await prisma.apiKey.update({
    where: { id: apiKeyId },
    data: {
      lastUsedAt: new Date(),
    },
  })
}

export async function listAllApiKeys() {
  return prisma.apiKey.findMany({
    include: {
      user: { select: { id: true, name: true, username: true } },
    },
    orderBy: { createdAt: "desc" },
  })
}

export async function setApiKeyActive(
  id: string,
  isActive: boolean,
): Promise<void> {
  await prisma.apiKey.update({
    where: { id },
    data: { isActive },
  })
}

export async function deleteApiKey(id: string): Promise<void> {
  await prisma.apiKey.delete({ where: { id } })
}

export async function consumeApiKeyRateLimit(
  apiKeyId: string,
  rateLimit: number,
  now = new Date(),
): Promise<{ remaining: number; resetAt: Date }> {
  const windowStart = getRateLimitWindowStart(now)
  const resetAt = new Date(windowStart)
  resetAt.setUTCHours(resetAt.getUTCHours() + 1)
  const deleteBefore = new Date(windowStart)
  deleteBefore.setUTCHours(
    deleteBefore.getUTCHours() - API_KEY_RATE_LIMIT_WINDOW_RETENTION_HOURS,
  )

  const [rateLimitWindow] = await prisma.$transaction([
    prisma.apiKeyRateLimitWindow.upsert({
      where: {
        apiKeyId_windowStart: {
          apiKeyId,
          windowStart,
        },
      },
      create: {
        apiKeyId,
        windowStart,
        requestCount: 1,
      },
      update: {
        requestCount: {
          increment: 1,
        },
      },
      select: {
        requestCount: true,
      },
    }),
    prisma.apiKeyRateLimitWindow.deleteMany({
      where: {
        windowStart: {
          lt: deleteBefore,
        },
      },
    }),
  ])

  if (rateLimitWindow.requestCount > rateLimit) {
    throw new ApiKeyRateLimitExceededError(rateLimit, resetAt)
  }

  return {
    remaining: Math.max(rateLimit - rateLimitWindow.requestCount, 0),
    resetAt,
  }
}
