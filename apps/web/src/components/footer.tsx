import { Icons } from "@/components/icons"
import { Link } from "@/components/link"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import type { NavLink } from "@/lib/types"
import { SITE_CONFIG, FOOTER_LINKS, EXTERNAL_LINKS } from "@/lib/util/constants"

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
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-semibold tracking-tight">
                {SITE_CONFIG.name}
              </h3>
              <ThemeToggle />
            </div>
            <p className="text-muted-foreground text-sm leading-relaxed">
              {SITE_CONFIG.description}
            </p>
          </div>

          <FooterLinkSection title="Build" links={FOOTER_LINKS.build} />
          <FooterLinkSection title="Community" links={FOOTER_LINKS.community} />
          <FooterLinkSection title="Legal" links={FOOTER_LINKS.legal} />
        </div>

        <Separator className="my-8" />

        <div className="mb-8 flex justify-center">
          <div className="bg-muted/30 flex max-w-xl flex-col items-center gap-3 rounded-xl border px-6 py-5 text-center">
            <p className="text-sm leading-relaxed">
              <span className="text-foreground font-semibold">
                Arsenyx is free and ad-free
              </span>
              <span className="text-muted-foreground">
                , and costs me about $10 a month to keep online. If it&apos;s
                useful to you, a small tip helps cover it.
              </span>
            </p>
            <Button
              size="sm"
              render={
                <Link
                  href={EXTERNAL_LINKS.koFi}
                  target="_blank"
                  rel="noopener noreferrer"
                />
              }
              nativeButton={false}
            >
              <Icons.heart data-icon="inline-start" />
              Support on Ko-fi
            </Button>
          </div>
        </div>

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
