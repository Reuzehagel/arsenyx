import { useMutation, useQueryClient } from "@tanstack/react-query"

import { apiFetch, ApiError } from "@/lib/util/api-client"

type ForkResponse = { id: string; slug: string }

export function useDeleteBuild(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<void> => {
      try {
        await apiFetch<void>(`/builds/${encodeURIComponent(slug)}`, {
          method: "DELETE",
        })
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 401)
            throw new Error("unauthorized", { cause: err })
          if (err.status === 403) throw new Error("forbidden", { cause: err })
          throw new Error("failed_delete", { cause: err })
        }
        throw err
      }
    },
    onSuccess: () => {
      qc.removeQueries({ queryKey: ["build", slug] })
      qc.invalidateQueries({ queryKey: ["builds"] })
    },
  })
}

export function useForkBuild(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<ForkResponse> => {
      try {
        return await apiFetch<ForkResponse>(
          `/builds/${encodeURIComponent(slug)}/fork`,
          { method: "POST" },
        )
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 401)
            throw new Error("unauthorized", { cause: err })
          if (err.status === 404) throw new Error("not_found", { cause: err })
          throw new Error("failed_fork", { cause: err })
        }
        throw err
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["builds"] })
    },
  })
}
