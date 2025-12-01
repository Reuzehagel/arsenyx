import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Icons } from "@/components/icons";
import { SITE_CONFIG, FOOTER_LINKS } from "@/lib/constants";
import type { NavLink } from "@/lib/types";

// Footer link component
function FooterLink({ label, href, external }: NavLink) {
  return (
    <li>
      <Link
        href={href}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
        {...(external && {
          target: "_blank",
          rel: "noopener noreferrer",
        })}
      >
        {label}
        {external && <Icons.externalLink className="h-3 w-3" />}
      </Link>
    </li>
  );
}

// Footer link section component
function FooterLinkSection({
  title,
  links,
}: {
  title: string;
  links: readonly NavLink[];
}) {
  return (
    <div className="space-y-4">
      <h4 className="text-sm font-semibold">{title}</h4>
      <ul className="space-y-2">
        {links.map((link) => (
          <FooterLink key={link.href} {...link} />
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container py-10">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold tracking-tight">
              {SITE_CONFIG.name}
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {SITE_CONFIG.description}
            </p>
          </div>

          <FooterLinkSection title="Build" links={FOOTER_LINKS.build} />
          <FooterLinkSection title="Community" links={FOOTER_LINKS.community} />
          <FooterLinkSection title="Legal" links={FOOTER_LINKS.legal} />
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © {SITE_CONFIG.year} {SITE_CONFIG.author}. Not affiliated with
            Digital Extremes.
          </p>
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <span>Made with</span>
            <Icons.heart className="h-4 w-4 text-red-500 fill-red-500" />
            <span>for the Warframe community</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
