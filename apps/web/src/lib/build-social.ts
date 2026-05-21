import { useMutation, useQueryClient } from "@tanstack/react-query"

import { apiFetch, ApiError } from "@/lib/api-client"
import type { BuildDetail } from "@/lib/build-query"

type LikeResponse = { hasLiked: boolean; likeCount: number }
type BookmarkResponse = { hasBookmarked: boolean; bookmarkCount: number }

async function send<T>(
  slug: string,
  kind: "like" | "bookmark",
  method: "POST" | "DELETE",
): Promise<T> {
  try {
    return await apiFetch<T>(`/builds/${encodeURIComponent(slug)}/${kind}`, {
      method,
    })
  } catch (err) {
    if (err instanceof ApiError && err.status === 401)
      throw new Error("unauthorized", { cause: err })
    if (err instanceof ApiError)
      throw new Error(`failed_${kind}`, { cause: err })
    throw err
  }
}

export function useToggleLike(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (next: boolean): Promise<LikeResponse> =>
      send<LikeResponse>(slug, "like", next ? "POST" : "DELETE"),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ["build", slug] })
      const prev = qc.getQueryData<BuildDetail>(["build", slug])
      if (prev) {
        qc.setQueryData<BuildDetail>(["build", slug], {
          ...prev,
          viewerHasLiked: next,
          likeCount: prev.likeCount + (next ? 1 : -1),
        })
      }
      return { prev }
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(["build", slug], ctx.prev)
    },
    onSuccess: (data) => {
      const cur = qc.getQueryData<BuildDetail>(["build", slug])
      if (cur) {
        qc.setQueryData<BuildDetail>(["build", slug], {
          ...cur,
          viewerHasLiked: data.hasLiked,
          likeCount: data.likeCount,
        })
      }
    },
  })
}

export function useToggleBookmark(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (next: boolean): Promise<BookmarkResponse> =>
      send<BookmarkResponse>(slug, "bookmark", next ? "POST" : "DELETE"),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ["build", slug] })
      const prev = qc.getQueryData<BuildDetail>(["build", slug])
      if (prev) {
        qc.setQueryData<BuildDetail>(["build", slug], {
          ...prev,
          viewerHasBookmarked: next,
          bookmarkCount: prev.bookmarkCount + (next ? 1 : -1),
        })
      }
      return { prev }
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(["build", slug], ctx.prev)
    },
    onSuccess: (data) => {
      const cur = qc.getQueryData<BuildDetail>(["build", slug])
      if (cur) {
        qc.setQueryData<BuildDetail>(["build", slug], {
          ...cur,
          viewerHasBookmarked: data.hasBookmarked,
          bookmarkCount: data.bookmarkCount,
        })
      }
      qc.invalidateQueries({ queryKey: ["builds", "bookmarks"] })
    },
  })
}
