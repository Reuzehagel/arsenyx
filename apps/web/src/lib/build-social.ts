import { useMutation, useQueryClient } from "@tanstack/react-query";

import { API_URL } from "@/lib/constants";
import type { BuildDetail } from "@/lib/build-query";

type VoteResponse = { hasVoted: boolean; voteCount: number };
type FavoriteResponse = { hasFavorited: boolean; favoriteCount: number };

async function send<T>(slug: string, kind: "vote" | "favorite", method: "POST" | "DELETE"): Promise<T> {
  const r = await fetch(
    `${API_URL}/builds/${encodeURIComponent(slug)}/${kind}`,
    { method, credentials: "include" },
  );
  if (r.status === 401) throw new Error("unauthorized");
  if (!r.ok) throw new Error(`failed_${kind}`);
  return r.json();
}

export function useToggleVote(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (next: boolean): Promise<VoteResponse> =>
      send<VoteResponse>(slug, "vote", next ? "POST" : "DELETE"),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ["build", slug] });
      const prev = qc.getQueryData<BuildDetail>(["build", slug]);
      if (prev) {
        qc.setQueryData<BuildDetail>(["build", slug], {
          ...prev,
          viewerHasVoted: next,
          voteCount: prev.voteCount + (next ? 1 : -1),
        });
      }
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(["build", slug], ctx.prev);
    },
    onSuccess: (data) => {
      const cur = qc.getQueryData<BuildDetail>(["build", slug]);
      if (cur) {
        qc.setQueryData<BuildDetail>(["build", slug], {
          ...cur,
          viewerHasVoted: data.hasVoted,
          voteCount: data.voteCount,
        });
      }
    },
  });
}

export function useToggleFavorite(slug: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (next: boolean): Promise<FavoriteResponse> =>
      send<FavoriteResponse>(slug, "favorite", next ? "POST" : "DELETE"),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ["build", slug] });
      const prev = qc.getQueryData<BuildDetail>(["build", slug]);
      if (prev) {
        qc.setQueryData<BuildDetail>(["build", slug], {
          ...prev,
          viewerHasFavorited: next,
          favoriteCount: prev.favoriteCount + (next ? 1 : -1),
        });
      }
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(["build", slug], ctx.prev);
    },
    onSuccess: (data) => {
      const cur = qc.getQueryData<BuildDetail>(["build", slug]);
      if (cur) {
        qc.setQueryData<BuildDetail>(["build", slug], {
          ...cur,
          viewerHasFavorited: data.hasFavorited,
          favoriteCount: data.favoriteCount,
        });
      }
      qc.invalidateQueries({ queryKey: ["builds", "favorites"] });
    },
  });
}
