import { Link as RouterLink } from "@tanstack/react-router"
import type { AnchorHTMLAttributes } from "react"

/**
 * Drop-in replacement for `next/link` that uses TanStack Router for internal
 * paths and a plain anchor tag for external URLs. Keeps ported components from
 * needing mass refactors during migration.
 */
export type LinkProps = {
  href: string
  children?: React.ReactNode
} & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href">

export function Link({ href, children, ...rest }: LinkProps) {
  const isExternal = /^(https?:)?\/\//.test(href) || href.startsWith("mailto:")
  if (isExternal) {
    return (
      <a href={href} {...rest}>
        {children}
      </a>
    )
  }
  return (
    <RouterLink to={href} {...rest}>
      {children}
    </RouterLink>
  )
}
