import { createHash, randomBytes } from "node:crypto"

import { prisma } from "../db"
import type { Prisma } from "../generated/prisma/client"

const API_KEY_PREFIX = "ars_live_"
const API_KEY_SECRET_BYTES = 24
const API_KEY_PREFIX_LENGTH = 16

export const SCOPE_BUILD_READ = "build:read"
export const SCOPE_BUILD_WRITE = "build:write"
export const SCOPE_IMAGE_GENERATE = "image:generate"
export type ApiKeyScope =
  | typeof SCOPE_BUILD_READ
  | typeof SCOPE_BUILD_WRITE
  | typeof SCOPE_IMAGE_GENERATE

export const DEFAULT_API_KEY_SCOPES: readonly ApiKeyScope[] = [
  SCOPE_BUILD_READ,
  SCOPE_BUILD_WRITE,
]
export const ALL_API_KEY_SCOPES: readonly ApiKeyScope[] = [
  SCOPE_BUILD_READ,
  SCOPE_BUILD_WRITE,
  SCOPE_IMAGE_GENERATE,
]
export const PRIVILEGED_API_KEY_SCOPES: readonly ApiKeyScope[] = [
  SCOPE_IMAGE_GENERATE,
]
export const DEFAULT_API_KEY_RATE_LIMIT = 60
export const MAX_ACTIVE_API_KEYS_PER_USER = 10

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

export class ApiKeyLimitExceededError extends Error {
  constructor(public readonly limit: number) {
    super(`You can only have ${limit} active API keys`)
    this.name = "ApiKeyLimitExceededError"
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

const LIST_SELECT = {
  id: true,
  name: true,
  keyPrefix: true,
  scopes: true,
  rateLimit: true,
  isActive: true,
  createdAt: true,
  expiresAt: true,
  lastUsedAt: true,
} satisfies Prisma.ApiKeySelect

async function createApiKeyInTransaction(
  tx: Prisma.TransactionClient,
  userId: string,
  input: CreateApiKeyInput,
): Promise<CreatedApiKey> {
  await tx.$queryRaw`SELECT id FROM "users" WHERE id = ${userId} FOR UPDATE`

  const activeKeyCount = await tx.apiKey.count({
    where: { userId, isActive: true },
  })

  if (activeKeyCount >= MAX_ACTIVE_API_KEYS_PER_USER) {
    throw new ApiKeyLimitExceededError(MAX_ACTIVE_API_KEYS_PER_USER)
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
          : [...DEFAULT_API_KEY_SCOPES],
      rateLimit: input.rateLimit ?? DEFAULT_API_KEY_RATE_LIMIT,
      expiresAt: input.expiresAt ?? null,
    },
    select: LIST_SELECT,
  })

  return { token, apiKey }
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
  return prisma.apiKey.findMany({
    where: { userId },
    select: LIST_SELECT,
    orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
  })
}

export async function revokeApiKey(
  userId: string,
  apiKeyId: string,
): Promise<boolean> {
  const result = await prisma.apiKey.updateMany({
    where: { id: apiKeyId, userId, isActive: true },
    data: { isActive: false },
  })
  return result.count > 0
}
