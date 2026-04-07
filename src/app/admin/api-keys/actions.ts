"use server"

import { revalidatePath } from "next/cache"

import { requireAdmin } from "@/lib/auth-helpers"
import {
  createApiKey,
  setApiKeyActive,
  deleteApiKey,
} from "@/lib/db/api-keys"
import { type Result, ok, err } from "@/lib/result"

export async function createApiKeyAction(formData: FormData): Promise<
  Result<{ rawKey: string; prefix: string }>
> {
  const auth = await requireAdmin("manage API keys")
  if (!auth.success) return auth

  const name = formData.get("name") as string
  const scopes = (formData.get("scopes") as string)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  const rateLimit = Number(formData.get("rateLimit")) || 60
  const expiresIn = formData.get("expiresIn") as string | null

  if (!name || name.length < 2) {
    return err("Name must be at least 2 characters")
  }

  if (scopes.length === 0) {
    return err("At least one scope is required")
  }

  let expiresAt: Date | null = null
  if (expiresIn === "30d") {
    expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
  } else if (expiresIn === "90d") {
    expiresAt = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
  } else if (expiresIn === "1y") {
    expiresAt = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
  }

  const result = await createApiKey(auth.data, {
    name,
    scopes,
    rateLimit,
    expiresAt,
  })

  revalidatePath("/admin")

  return ok({ rawKey: result.token, prefix: result.apiKey.keyPrefix })
}

export async function toggleApiKeyAction(
  id: string,
  isActive: boolean,
): Promise<Result> {
  const auth = await requireAdmin("manage API keys")
  if (!auth.success) return auth

  await setApiKeyActive(id, isActive)
  revalidatePath("/admin")
  return ok()
}

export async function deleteApiKeyAction(id: string): Promise<Result> {
  const auth = await requireAdmin("manage API keys")
  if (!auth.success) return auth

  await deleteApiKey(id)
  revalidatePath("/admin")
  return ok()
}
