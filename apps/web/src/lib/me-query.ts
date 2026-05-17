import { queryOptions } from "@tanstack/react-query"

import { apiErrorMessage, apiFetch, ApiError } from "@/lib/api-client"
import { API_URL } from "@/lib/constants"

export async function downloadMyBuildsExport(): Promise<void> {
  const r = await fetch(`${API_URL}/me/builds/export`, {
    credentials: "include",
  })
  if (!r.ok) throw new Error("failed to export builds")
  const blob = await r.blob()
  const url = URL.createObjectURL(blob)
  const disposition = r.headers.get("Content-Disposition") ?? ""
  const match = /filename="([^"]+)"/.exec(disposition)
  const filename = match?.[1] ?? `arsenyx-builds.json`
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export type ApiKeySummary = {
  id: string
  name: string
  keyPrefix: string
  scopes: string[]
  rateLimit: number
  isActive: boolean
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
}

export type MyApiKeysResponse = {
  apiKeys: ApiKeySummary[]
}

export type CreateApiKeyResponse = {
  token: string
  apiKey: ApiKeySummary
}

export const myApiKeysQuery = () =>
  queryOptions({
    queryKey: ["me", "api-keys"],
    queryFn: async (): Promise<MyApiKeysResponse> => {
      try {
        return await apiFetch<MyApiKeysResponse>(`/me/api-keys`)
      } catch (err) {
        if (err instanceof ApiError && err.status === 401)
          throw new Error("unauthorized", { cause: err })
        throw new Error("failed to load API keys", { cause: err })
      }
    },
    retry: false,
  })

export async function createApiKey(input: {
  name: string
  expiresAt: string | null
  scopes?: string[]
}): Promise<CreateApiKeyResponse> {
  try {
    return await apiFetch<CreateApiKeyResponse>(`/me/api-keys`, {
      method: "POST",
      json: input,
    })
  } catch (err) {
    throw new Error(apiErrorMessage(err, "Request failed"))
  }
}

export async function revokeApiKey(id: string): Promise<void> {
  try {
    await apiFetch<void>(`/me/api-keys/${encodeURIComponent(id)}`, {
      method: "DELETE",
    })
  } catch (err) {
    throw new Error(apiErrorMessage(err, "Request failed"))
  }
}
