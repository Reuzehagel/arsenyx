import { Icons } from "@/components/icons"
import { Link } from "@/components/link"
import type { TrustSignal } from "@/lib/types"

export function TrustSignalItem({ label, href, iconKey }: TrustSignal) {
  const Icon = iconKey ? Icons[iconKey] : null

  if (href) {
    return (
      <Link
        href={href}
        className="hover:text-foreground inline-flex items-center gap-1.5 transition-colors"
        target="_blank"
        rel="noopener noreferrer"
      >
        {Icon && <Icon className="size-4" />}
        {label}
      </Link>
    )
  }

  return <span>{label}</span>
}
