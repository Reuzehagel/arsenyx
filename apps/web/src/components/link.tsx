import { Link as RouterLink } from "@tanstack/react-router"
import type { AnchorHTMLAttributes } from "react"

/**
 * Link for a runtime string `href` (nav tables, data-driven URLs): internal
 * paths go through TanStack Router, external URLs (`http(s)://`, `//`,
 * `mailto:`) render a plain anchor. For a fixed in-app route, prefer the
 * router's own `Link` with a typed `to`.
 */
type LinkProps = {
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
