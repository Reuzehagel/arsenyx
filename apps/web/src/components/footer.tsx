import { Icons } from "@/components/icons"
import { Link } from "@/components/link"
import { Separator } from "@/components/ui/separator"
import { SITE_CONFIG, FOOTER_LINKS } from "@/lib/constants"
import type { NavLink } from "@/lib/types"

// Footer link component
function FooterLink({ label, href, external }: NavLink) {
  return (
    <li>
      <Link
        href={href}
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-sm transition-colors"
        {...(external && {
          target: "_blank",
          rel: "noopener noreferrer",
        })}
      >
        {label}
        {external && <Icons.externalLink className="h-3 w-3" />}
      </Link>
    </li>
  )
}

// Footer link section component
function FooterLinkSection({
  title,
  links,
}: {
  title: string
  links: readonly NavLink[]
}) {
  return (
    <div className="flex flex-col gap-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="flex flex-col gap-2">
        {links.map((link) => (
          <FooterLink key={link.href} {...link} />
        ))}
      </ul>
    </div>
  )
}

export function Footer() {
  return (
    <footer className="bg-background border-t">
      <div className="wrap py-10">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="flex flex-col gap-4">
            <h3 className="text-lg font-semibold tracking-tight">
              {SITE_CONFIG.name}
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {SITE_CONFIG.description}
            </p>
          </div>

          <FooterLinkSection title="Build" links={FOOTER_LINKS.build} />
          <FooterLinkSection title="Community" links={FOOTER_LINKS.community} />
          <FooterLinkSection title="Legal" links={FOOTER_LINKS.legal} />
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <p className="text-muted-foreground text-sm">
            © {SITE_CONFIG.year} {SITE_CONFIG.author}. Not affiliated with
            Digital Extremes.
          </p>
          <div className="text-muted-foreground flex items-center gap-1 text-sm">
            <span>Made with</span>
            <Icons.heart className="text-destructive fill-destructive size-4" />
            <span>for the Warframe community</span>
          </div>
        </div>
      </div>
    </footer>
  )
}
