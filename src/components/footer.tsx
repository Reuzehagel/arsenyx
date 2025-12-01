import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Icons } from "@/components/icons";

const footerLinks = {
  build: [
    { label: "Browse Items", href: "/browse" },
    { label: "Create Build", href: "/create" },
    { label: "Import Build", href: "/import" },
    { label: "Templates", href: "/templates" },
  ],
  community: [
    { label: "Build Feed", href: "/feed" },
    { label: "Documentation", href: "/docs" },
    { label: "Changelog", href: "/changelog" },
    { label: "GitHub", href: "https://github.com/arsenix", external: true },
  ],
  legal: [
    { label: "Privacy Policy", href: "/privacy" },
    { label: "Terms of Service", href: "/terms" },
    { label: "About", href: "/about" },
  ],
};

export function Footer() {
  return (
    <footer className="border-t bg-background">
      <div className="container py-10">
        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold tracking-tight">ARSENIX</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Open-source Warframe build planner. Fast, keyboard-first, and
              community-driven.
            </p>
          </div>

          {/* Build Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Build</h4>
            <ul className="space-y-2">
              {footerLinks.build.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Community Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Community</h4>
            <ul className="space-y-2">
              {footerLinks.community.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                    {...(link.external && {
                      target: "_blank",
                      rel: "noopener noreferrer",
                    })}
                  >
                    {link.label}
                    {link.external && (
                      <Icons.externalLink className="h-3 w-3" />
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal Links */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold">Legal</h4>
            <ul className="space-y-2">
              {footerLinks.legal.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <Separator className="my-8" />

        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-sm text-muted-foreground">
            © 2025 Arsenix. Not affiliated with Digital Extremes.
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
