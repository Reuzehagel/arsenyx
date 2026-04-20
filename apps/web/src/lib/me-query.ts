import { queryOptions } from "@tanstack/react-query"

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

async function readError(r: Response): Promise<string> {
  try {
    const data = (await r.json()) as { error?: string; message?: string }
    return data.message ?? data.error ?? `Request failed (${r.status})`
  } catch {
    return `Request failed (${r.status})`
  }
}

export const myApiKeysQuery = () =>
  queryOptions({
    queryKey: ["me", "api-keys"],
    queryFn: async (): Promise<MyApiKeysResponse> => {
      const r = await fetch(`${API_URL}/me/api-keys`, {
        credentials: "include",
      })
      if (r.status === 401) throw new Error("unauthorized")
      if (!r.ok) throw new Error("failed to load API keys")
      return r.json()
    },
    retry: false,
  })

export async function createApiKey(input: {
  name: string
  expiresAt: string | null
  scopes?: string[]
}): Promise<CreateApiKeyResponse> {
  const r = await fetch(`${API_URL}/me/api-keys`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  })
  if (!r.ok) throw new Error(await readError(r))
  return r.json()
}

export async function revokeApiKey(id: string): Promise<void> {
  const r = await fetch(`${API_URL}/me/api-keys/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  })
  if (!r.ok) throw new Error(await readError(r))
}
