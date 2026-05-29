import { queryOptions } from "@tanstack/react-query"

/** Zaw component (grip/link/strike) name → thumbnail URL, resolved at build
 *  time from the DE manifest (see scripts/build-items-index.ts). */
export const zawImagesQuery = queryOptions({
  queryKey: ["zaw-images"],
  queryFn: async (): Promise<Record<string, string>> => {
    const r = await fetch("/data/zaw-images.json")
    if (!r.ok) throw new Error("failed to load zaw images")
    return r.json()
  },
  staleTime: Infinity,
  gcTime: Infinity,
})
