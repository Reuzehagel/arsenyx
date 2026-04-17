import Link from "next/link"

interface OrgBadgeProps {
  name: string
  slug: string
  linked?: boolean
}

export function OrgBadge({ name, slug, linked = true }: OrgBadgeProps) {
  const content = (
    <span className="inline-flex min-w-0 items-center gap-1">
      <span className="shrink-0 rounded bg-[#7c3aed] px-[5px] py-[1px] text-[9px] font-semibold text-white">
        ORG
      </span>
      <span className="truncate text-[#a78bfa]">{name}</span>
    </span>
  )

  if (linked) {
    return (
      <Link href={`/org/${slug}`} className="hover:underline">
        {content}
      </Link>
    )
  }

  return content
}
