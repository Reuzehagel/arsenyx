import "server-only"

import { findApiKeyByHash, touchApiKey } from "@/lib/db/api-keys"
import { screenshotLimiter, RateLimitError } from "@/lib/rate-limit"

export type ApiKeyError =
  | { status: 401; error: "API key required" }
  | { status: 403; error: "Invalid API key" }
  | { status: 403; error: "Insufficient permissions" }
  | { status: 429; error: "Rate limit exceeded"; retryAfter: number }

export type ValidatedApiKey = {
  id: string
  userId: string
  name: string
  rateLimit: number
}

/**
 * Hash an API key using SHA-256
 */
export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(key)
  const hashBuffer = await crypto.subtle.digest("SHA-256", data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Generate a new raw API key
 * Format: ask_<32 random hex chars>
 */
export function generateRawApiKey(): string {
  const bytes = new Uint8Array(16)
  crypto.getRandomValues(bytes)
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
  return `ask_${hex}`
}

/**
 * Validate an API key from the Authorization header.
 * Returns the validated key info or an error with HTTP status.
 */
export async function validateApiKey(
  authHeader: string | null,
  requiredScope: string,
): Promise<
  | { success: true; key: ValidatedApiKey }
  | { success: false; error: ApiKeyError }
> {
  if (!authHeader?.startsWith("Bearer ")) {
    return {
      success: false,
      error: { status: 401, error: "API key required" },
    }
  }

  const rawKey = authHeader.slice(7)
  const hashedKey = await hashApiKey(rawKey)

  const apiKey = await findApiKeyByHash(hashedKey)
  if (!apiKey || !apiKey.isActive) {
    return {
      success: false,
      error: { status: 403, error: "Invalid API key" },
    }
  }

  if (apiKey.expiresAt && apiKey.expiresAt < new Date()) {
    return {
      success: false,
      error: { status: 403, error: "Invalid API key" },
    }
  }

  if (!apiKey.scopes.includes(requiredScope)) {
    return {
      success: false,
      error: { status: 403, error: "Insufficient permissions" },
    }
  }

  try {
    await screenshotLimiter.check(apiKey.rateLimit, apiKey.id)
  } catch (e) {
    if (e instanceof RateLimitError) {
      return {
        success: false,
        error: { status: 429, error: "Rate limit exceeded", retryAfter: 3600 },
      }
    }
    throw e
  }

  touchApiKey(apiKey.id).catch(() => {})

  return {
    success: true,
    key: {
      id: apiKey.id,
      userId: apiKey.userId,
      name: apiKey.name,
      rateLimit: apiKey.rateLimit,
    },
  }
}
