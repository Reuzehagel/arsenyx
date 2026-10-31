import { useMutation, useQueryClient } from "@tanstack/react-query"

import type { BuildDetail } from "@/lib/queries/build-query"
import { apiFetch, remapApiError } from "@/lib/util/api-client"

type LikeResponse = {
  hasLiked: boolean
  hasDisliked: boolean
  likeCount: number
  dislikeCount: number
}
type BookmarkResponse = { hasBookmarked: boolean; bookmarkCount: number }

async function send<T>(
  slug: string,
  kind: "like" | "dislike" | "bookmark",
  method: "POST" | "DELETE",
): Promise<T> {
  try {
    return await apiFetch<T>(`/builds/${encodeURIComponent(slug)}/${kind}`, {
      method,
    })
  } catch (err) {
    throw remapApiError(err, { 401: "unauthorized", default: `failed_${kind}` })
  }
}

/** 1 = Like, -1 = Dislike, 0 = neither. The two are exclusive per viewer. */
export type LikeState = 1 | -1 | 0

export function useSetLike(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    meta: { errorToast: "Couldn't update like" },
    mutationFn: async (next: LikeState): Promise<LikeResponse> =>
      next === 0
        ? send<LikeResponse>(slug, "like", "DELETE")
        : send<LikeResponse>(slug, next === 1 ? "like" : "dislike", "POST"),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ["build", slug] })
      const prev = qc.getQueryData<BuildDetail>(["build", slug])
      if (prev) {
        const was = prev.viewerHasLiked ? 1 : prev.viewerHasDisliked ? -1 : 0
        const delta = (v: LikeState) =>
          (next === v ? 1 : 0) - (was === v ? 1 : 0)
        qc.setQueryData<BuildDetail>(["build", slug], {
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
      if (ctx?.prev) qc.setQueryData(["build", slug], ctx.prev)
    },
    onSuccess: (data) => {
      const cur = qc.getQueryData<BuildDetail>(["build", slug])
      if (cur) {
        qc.setQueryData<BuildDetail>(["build", slug], {
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
  return useMutation({
    meta: { errorToast: "Couldn't update bookmark" },
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
