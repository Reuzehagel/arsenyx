import { useMutation, useQueryClient } from "@tanstack/react-query"

import { apiFetch, remapApiError } from "@/lib/util/api-client"

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
        throw remapApiError(err, {
          401: "unauthorized",
          403: "forbidden",
          default: "failed_delete",
        })
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
        throw remapApiError(err, {
          401: "unauthorized",
          404: "not_found",
          default: "failed_fork",
        })
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["builds"] })
    },
  })
}
