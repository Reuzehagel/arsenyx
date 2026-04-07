import "server-only"
import type { NextRequest } from "next/server"

import {
  ApiKeyRateLimitExceededError,
  consumeApiKeyRateLimit,
  findApiKeyByRawToken,
  touchApiKeyLastUsedAt,
} from "@/lib/db/api-keys"

export interface ApiKeyAuthContext {
  userId: string
  apiKeyId: string
  isBanned: boolean
}

export interface ApiKeyAuthFailure {
  status: number
  code: string
  message: string
}

export type ApiKeyAuthResult =
  | { success: true; data: ApiKeyAuthContext }
  | { success: false; error: ApiKeyAuthFailure }

function failure(
  status: number,
  code: string,
  message: string,
): ApiKeyAuthResult {
  return {
    success: false,
    error: {
      status,
      code,
      message,
    },
  }
}

export function parseBearerToken(authorization: string | null): string | null {
  if (!authorization) {
    return null
  }

  const [scheme, token] = authorization.split(/\s+/, 2)
  if (scheme.toLowerCase() !== "bearer" || !token) {
    return null
  }

  return token
}

export async function requireApiKey(
  request: NextRequest | Request,
  requiredScope: string,
): Promise<ApiKeyAuthResult> {
  const authorization = request.headers.get("authorization")
  if (!authorization) {
    return failure(401, "MISSING_BEARER_TOKEN", "Missing bearer token")
  }

  const token = parseBearerToken(authorization)
  if (!token) {
    return failure(
      401,
      "INVALID_BEARER_TOKEN",
      "Authorization header must be in the form 'Bearer <token>'",
    )
  }

  const apiKey = await findApiKeyByRawToken(token)
  if (!apiKey || !apiKey.isActive) {
    return failure(401, "INVALID_API_KEY", "Invalid API key")
  }

  if (apiKey.expiresAt && apiKey.expiresAt.getTime() <= Date.now()) {
    return failure(401, "API_KEY_EXPIRED", "API key has expired")
  }

  if (!apiKey.scopes.includes(requiredScope)) {
    return failure(403, "INSUFFICIENT_SCOPE", "API key is missing scope")
  }

  if (apiKey.user.isBanned) {
    return failure(403, "BANNED_USER", "Your account has been suspended")
  }

  try {
    await consumeApiKeyRateLimit(apiKey.id, apiKey.rateLimit)
  } catch (error) {
    if (error instanceof ApiKeyRateLimitExceededError) {
      return failure(429, "RATE_LIMIT_EXCEEDED", error.message)
    }

    throw error
  }

  await touchApiKeyLastUsedAt(apiKey.id)

  return {
    success: true,
    data: {
      userId: apiKey.userId,
      apiKeyId: apiKey.id,
      isBanned: apiKey.user.isBanned,
    },
  }
}
