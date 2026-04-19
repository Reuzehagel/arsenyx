import { useMutation, useQueryClient } from "@tanstack/react-query"

import { API_URL } from "@/lib/constants"

type ForkResponse = { id: string; slug: string }

export function useDeleteBuild(slug: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const r = await fetch(`${API_URL}/builds/${encodeURIComponent(slug)}`, {
        method: "DELETE",
        credentials: "include",
      })
      if (r.status === 401) throw new Error("unauthorized")
      if (r.status === 403) throw new Error("forbidden")
      if (!r.ok && r.status !== 204) throw new Error("failed_delete")
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
      const r = await fetch(
        `${API_URL}/builds/${encodeURIComponent(slug)}/fork`,
        { method: "POST", credentials: "include" },
      )
      if (r.status === 401) throw new Error("unauthorized")
      if (r.status === 404) throw new Error("not_found")
      if (!r.ok) throw new Error("failed_fork")
      return r.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["builds"] })
    },
  })
}
