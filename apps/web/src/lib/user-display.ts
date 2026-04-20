import type { BuildDetail } from "@/lib/build-query"

type UserLike = {
  name?: string | null
  username?: string | null
  displayUsername?: string | null
}

export function authorName(user: UserLike, fallback = "Anonymous"): string {
  return user.displayUsername ?? user.username ?? user.name ?? fallback
}

export function formatVisibility(v: BuildDetail["visibility"]): string {
  return v.charAt(0) + v.slice(1).toLowerCase()
}
