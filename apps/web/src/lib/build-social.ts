import { useMutation, useQueryClient } from "@tanstack/react-query"

import type { BuildDetail } from "@/lib/build-query"
import { API_URL } from "@/lib/constants"

type LikeResponse = { hasLiked: boolean; likeCount: number }
type BookmarkResponse = { hasBookmarked: boolean; bookmarkCount: number }

async function send<T>(
  slug: string,
  kind: "like" | "bookmark",
  method: "POST" | "DELETE",
): Promise<T> {
  const r = await fetch(
    `${API_URL}/builds/${encodeURIComponent(slug)}/${kind}`,
    { method, credentials: "include" },
  )
  if (r.status === 401) throw new Error("unauthorized")
  if (!r.ok) throw new Error(`failed_${kind}`)
  return r.json()
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
