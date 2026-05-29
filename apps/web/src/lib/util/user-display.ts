import type { BuildDetail } from "@/lib/queries/build-query"

import { titleCaseWord } from "./utils"

type UserLike = {
  name?: string | null
  username?: string | null
  displayUsername?: string | null
}

export function authorName(user: UserLike, fallback = "Anonymous"): string {
  return user.displayUsername ?? user.username ?? user.name ?? fallback
}

export function formatVisibility(v: BuildDetail["visibility"]): string {
  return titleCaseWord(v)
}
