const absoluteFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

export function formatAbsoluteTime(iso: string): string {
  const parts = absoluteFormatter.formatToParts(new Date(iso))
  const date: string[] = []
  const time: string[] = []
  let inTime = false
  for (const p of parts) {
    if (p.type === "hour") inTime = true
    ;(inTime ? time : date).push(p.value)
  }
  return `${date.join("").trim().replace(/,\s*$/, "")} · ${time.join("")}`
}

export function relativeTime(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  if (months < 12) return `${months}mo ago`
  return `${Math.floor(months / 12)}y ago`
}
