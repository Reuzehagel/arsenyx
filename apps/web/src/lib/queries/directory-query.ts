// Shared shape for the two public directories (organizations, profiles). Both
// take the same `?page` + `?q` pair and return the same pagination envelope, so
// the pages can stay near-identical.

export type DirectoryEnvelope = {
  total: number
  page: number
  limit: number
}

export function directoryQueryString(page: number, q?: string): string {
  const params = new URLSearchParams()
  if (page > 1) params.set("page", String(page))
  const trimmed = q?.trim()
  if (trimmed) params.set("q", trimmed)
  const str = params.toString()
  return str ? `?${str}` : ""
}
