import { Badge } from "@/components/ui/badge"
import type { ProfileBadges as Badges } from "@/lib/queries/profile-query"

// Ordered most- to least-privileged; a user holding several shows them all in
// this order. Shared by the profile page and the profile directory so the two
// can't drift on wording or colour.
const BADGE_STYLES: {
  key: keyof Badges
  label: string
  className: string
}[] = [
  { key: "admin", label: "Admin", className: "bg-red-500/15 text-red-500" },
  {
    key: "moderator",
    label: "Moderator",
    className: "bg-blue-500/15 text-blue-500",
  },
  {
    key: "communityLeader",
    label: "Community Leader",
    className: "bg-amber-500/15 text-amber-500",
  },
  {
    key: "verified",
    label: "Verified",
    className: "bg-emerald-500/15 text-emerald-500",
  },
]

export function ProfileBadges({
  badges,
  compact = false,
}: {
  badges: Badges
  /** Directory cards are tight on space — show only the highest-ranked badge. */
  compact?: boolean
}) {
  const items = BADGE_STYLES.filter((b) => badges[b.key])
  const shown = compact ? items.slice(0, 1) : items
  if (shown.length === 0) return null

  return (
    <span className="flex flex-wrap gap-1">
      {shown.map((b) => (
        <Badge
          key={b.label}
          variant="secondary"
          className={`${b.className} px-2 py-0.5 text-xs`}
        >
          {b.label}
        </Badge>
      ))}
    </span>
  )
}
