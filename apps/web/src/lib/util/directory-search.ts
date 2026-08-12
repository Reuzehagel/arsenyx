// Search-param contract shared by the two public directories (/orgs, /users).
// Both take `?page` + `?q`; both drop the defaults from the URL so the bare
// path stays canonical.

export type DirectorySearchParams = { page?: number; q?: string }

// Matches the API's own cap (`trimQ` in apps/api/src/routes/_query.ts) so the
// value in the URL is the value the server actually searched on. Capping here
// too means the input's committed text and the results can't disagree.
const MAX_Q = 100

export function parseDirectorySearch(search: unknown): DirectorySearchParams {
  const raw = search as { page?: unknown; q?: unknown }

  const n =
    typeof raw.page === "number"
      ? raw.page
      : parseInt(String(raw.page ?? ""), 10)
  const page = Number.isFinite(n) && n > 1 ? n : undefined

  const qRaw = typeof raw.q === "string" ? raw.q.trim().slice(0, MAX_Q) : ""
  const q = qRaw.length > 0 ? qRaw : undefined

  return { ...(q ? { q } : {}), ...(page ? { page } : {}) }
}
