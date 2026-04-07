"use server"

import { z } from "zod"

import { requireAuth } from "@/lib/auth-helpers"
import {
  createApiKey,
  listApiKeysForUser,
  revokeApiKey,
  type ApiKeyListItem,
} from "@/lib/db/api-keys"
import { err, getErrorMessage, ok, type Result } from "@/lib/result"

const createApiKeySchema = z.object({
  name: z.string().trim().min(1, "Token name is required").max(100),
  expiresIn: z.enum(["never", "30d", "90d", "1y"]).default("never"),
})

export interface CreateApiKeyActionResult {
  token: string
  apiKey: ApiKeyListItem
}

function resolveExpiry(
  expiresIn: z.infer<typeof createApiKeySchema>["expiresIn"],
) {
  const now = new Date()

  switch (expiresIn) {
    case "30d":
      now.setDate(now.getDate() + 30)
      return now
    case "90d":
      now.setDate(now.getDate() + 90)
      return now
    case "1y":
      now.setFullYear(now.getFullYear() + 1)
      return now
    case "never":
    default:
      return null
  }
}

export async function listApiKeysAction(): Promise<Result<ApiKeyListItem[]>> {
  try {
    const auth = await requireAuth("view API keys")
    if (!auth.success) return auth

    const apiKeys = await listApiKeysForUser(auth.data)
    return ok(apiKeys)
  } catch (error) {
    return err(getErrorMessage(error, "Failed to load API keys"))
  }
}

export async function createApiKeyAction(
  input: z.infer<typeof createApiKeySchema>,
): Promise<Result<CreateApiKeyActionResult>> {
  try {
    const auth = await requireAuth("create an API key")
    if (!auth.success) return auth

    const parsed = createApiKeySchema.safeParse(input)
    if (!parsed.success) {
      return err(parsed.error.issues[0]?.message ?? "Invalid API key input")
    }

    const created = await createApiKey(auth.data, {
      name: parsed.data.name,
      expiresAt: resolveExpiry(parsed.data.expiresIn),
    })

    return ok(created)
  } catch (error) {
    return err(getErrorMessage(error, "Failed to create API key"))
  }
}

export async function revokeApiKeyAction(
  apiKeyId: string,
): Promise<Result<void>> {
  try {
    const auth = await requireAuth("revoke an API key")
    if (!auth.success) return auth

    await revokeApiKey(auth.data, apiKeyId)
    return ok()
  } catch (error) {
    return err(getErrorMessage(error, "Failed to revoke API key"))
  }
}
