import type { BuildDetailResponse } from "@arsenyx/shared/api/build-dto"

type UserLike = {
  name?: string | null
  username?: string | null
  displayUsername?: string | null
}

export function authorName(user: UserLike, fallback = "Anonymous"): string {
  return user.displayUsername ?? user.username ?? user.name ?? fallback
}

/** "PUBLIC" → "Public". */
export function formatVisibility(v: BuildDetailResponse["visibility"]): string {
  return v.charAt(0) + v.slice(1).toLowerCase()
}
