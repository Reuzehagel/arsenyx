import type {
  BuildDetailResponse,
  BuildRevisionsResponse,
} from "@arsenyx/shared/api/build-dto"
import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { isLegacyBuildData } from "@/lib/codec/build-codec-adapter"
import { apiCall } from "@/lib/util/api-client"

import { arcanesQuery } from "./arcanes-query"
import type { BuildListParams, BuildListScope } from "./builds-list-query"
import { helminthQuery } from "./helminth-query"
import { modsQuery } from "./mods-query"

/**
 * Query keys for builds. A build's partners and revisions nest under its
 * detail key on purpose: invalidating `detail(slug)` (a save, an admin
 * visibility change) prefix-matches both, so the history sheet and the
 * related-builds strip refresh with the build. `removeQueries(detail)` on
 * delete drops them too. Every list lives under `lists`, which mutations that
 * change what any list shows (save, delete, fork, admin, org) invalidate.
 */
export const buildKeys = {
  detail: (slug: string) => ["build", slug] as const,
  partners: (slug: string) => ["build", slug, "partners"] as const,
  revisions: (slug: string) => ["build", slug, "revisions"] as const,
  lists: ["builds"] as const,
  // List keys share one (non-literal) type so the list routes can hand any
  // of their queries to the same list view.
  scope: (scope: BuildListScope) => ["builds", scope] as const,
  list: (scope: BuildListScope, params: BuildListParams) => [
    "builds",
    scope,
    params,
  ],
  orgList: (slug: string, params: BuildListParams) => [
    "builds",
    "org",
    slug.toLowerCase(),
    params,
  ],
  profileList: (username: string, params: BuildListParams) => [
    "builds",
    "profile",
    username.toLowerCase(),
    params,
  ],
  partnerSearch: (q: string) => ["builds", "search", "mine", q] as const,
}

const buildPath = (slug: string) => `/builds/${encodeURIComponent(slug)}`

const fetchBuild = (slug: string, opts?: { countView?: boolean }) =>
  apiCall<BuildDetailResponse>(
    `${buildPath(slug)}${opts?.countView === false ? "?view=0" : ""}`,
    { notFoundOn404: true },
  )

/**
 * @param countView when `false`, fetches `/builds/:slug?view=0` so the server
 *   skips the view-count bump (and its per-view cookie) and serves a
 *   browser-cacheable response. Used by the embed entry — embed impressions
 *   are not build views. The payload is identical either way, so the query key
 *   stays the same (full page and embed never coexist in one document).
 */
export const buildQuery = (slug: string, opts?: { countView?: boolean }) =>
  queryOptions({
    queryKey: buildKeys.detail(slug),
    queryFn: () => fetchBuild(slug, opts),
  })

/** The build being edited, or null for a new build — so the editor can
 *  suspend on it unconditionally. Shares `buildQuery`'s cache entry. */
export const editedBuildQuery = (slug: string | undefined) =>
  queryOptions({
    queryKey: buildKeys.detail(slug ?? ""),
    queryFn: () => (slug ? fetchBuild(slug) : null),
  })

/**
 * The full catalogs a build's viewer needs, or `null` when it needs none.
 * Only legacy BuildState-shape builds rebuild their mods from uniqueNames
 * (~1.35 MB); new-format builds carry mod/arcane objects inline and refresh
 * their images from image-map.json instead. Shared by the route loader (warm)
 * and the viewer body (suspend).
 */
export function catalogQueriesFor(buildData: unknown) {
  return isLegacyBuildData(buildData)
    ? ([modsQuery, arcanesQuery, helminthQuery] as const)
    : null
}

/**
 * A build's edit log. Session-gated and permission-gated server-side (the same
 * check that governs editing), so this is only ever fetched for a viewer the
 * detail payload already marked `isOwner`.
 *
 * `enabled: false` by default — the history lives behind a button, and fetching
 * it on every build page view would spend a query nobody asked for. The sheet
 * enables it on open.
 */
export const buildRevisionsQuery = (slug: string, enabled: boolean) =>
  queryOptions({
    queryKey: buildKeys.revisions(slug),
    queryFn: () =>
      apiCall<BuildRevisionsResponse>(`${buildPath(slug)}/revisions`, {
        codes: { default: "failed_load_revisions" },
      }),
    enabled,
    // The log only changes when someone saves the build, which is rare next to
    // opening the sheet. Re-opening inside the window reuses the cached list.
    staleTime: 60_000,
  })

export function useDeleteBuild(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    meta: { errorToast: "Couldn't delete the build" },
    mutationFn: () =>
      apiCall<void>(buildPath(slug), {
        method: "DELETE",
        codes: {
          401: "unauthorized",
          403: "forbidden",
          default: "failed_delete",
        },
      }),
    onSuccess: () => {
      qc.removeQueries({ queryKey: buildKeys.detail(slug) })
      qc.invalidateQueries({ queryKey: buildKeys.lists })
    },
  })
}

export function useForkBuild(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    meta: { errorToast: "Couldn't fork the build" },
    mutationFn: () =>
      apiCall<{ id: string; slug: string }>(`${buildPath(slug)}/fork`, {
        method: "POST",
        codes: {
          401: "unauthorized",
          404: "not_found",
          default: "failed_fork",
        },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: buildKeys.lists })
    },
  })
}

type LikeResponse = {
  hasLiked: boolean
  hasDisliked: boolean
  likeCount: number
  dislikeCount: number
}
type BookmarkResponse = { hasBookmarked: boolean; bookmarkCount: number }

function sendSocial<T>(
  slug: string,
  kind: "like" | "dislike" | "bookmark",
  method: "POST" | "DELETE",
): Promise<T> {
  return apiCall<T>(`${buildPath(slug)}/${kind}`, {
    method,
    codes: { 401: "unauthorized", default: `failed_${kind}` },
  })
}

/** 1 = Like, -1 = Dislike, 0 = neither. The two are exclusive per viewer. */
type LikeState = 1 | -1 | 0

export function useSetLike(slug: string) {
  const qc = useQueryClient()
  const key = buildKeys.detail(slug)
  return useMutation({
    meta: { errorToast: "Couldn't update like" },
    mutationFn: (next: LikeState): Promise<LikeResponse> =>
      next === 0
        ? sendSocial<LikeResponse>(slug, "like", "DELETE")
        : sendSocial<LikeResponse>(
            slug,
            next === 1 ? "like" : "dislike",
            "POST",
          ),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<BuildDetailResponse>(key)
      if (prev) {
        const was = prev.viewerHasLiked ? 1 : prev.viewerHasDisliked ? -1 : 0
        const delta = (v: LikeState) =>
          (next === v ? 1 : 0) - (was === v ? 1 : 0)
        qc.setQueryData<BuildDetailResponse>(key, {
          ...prev,
          viewerHasLiked: next === 1,
          viewerHasDisliked: next === -1,
          likeCount: prev.likeCount + delta(1),
          dislikeCount: prev.dislikeCount + delta(-1),
        })
      }
      return { prev }
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSuccess: (data) => {
      const cur = qc.getQueryData<BuildDetailResponse>(key)
      if (cur) {
        qc.setQueryData<BuildDetailResponse>(key, {
          ...cur,
          viewerHasLiked: data.hasLiked,
          viewerHasDisliked: data.hasDisliked,
          likeCount: data.likeCount,
          dislikeCount: data.dislikeCount,
        })
      }
    },
  })
}

export function useToggleBookmark(slug: string) {
  const qc = useQueryClient()
  const key = buildKeys.detail(slug)
  return useMutation({
    meta: { errorToast: "Couldn't update bookmark" },
    mutationFn: (next: boolean): Promise<BookmarkResponse> =>
      sendSocial<BookmarkResponse>(slug, "bookmark", next ? "POST" : "DELETE"),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<BuildDetailResponse>(key)
      if (prev) {
        qc.setQueryData<BuildDetailResponse>(key, {
          ...prev,
          viewerHasBookmarked: next,
          bookmarkCount: prev.bookmarkCount + (next ? 1 : -1),
        })
      }
      return { prev }
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev)
    },
    onSuccess: (data) => {
      const cur = qc.getQueryData<BuildDetailResponse>(key)
      if (cur) {
        qc.setQueryData<BuildDetailResponse>(key, {
          ...cur,
          viewerHasBookmarked: data.hasBookmarked,
          bookmarkCount: data.bookmarkCount,
        })
      }
      qc.invalidateQueries({ queryKey: buildKeys.scope("bookmarks") })
    },
  })
}
