import Link from "next/link";
import { Github, Twitter } from "lucide-react";
import { SITE, SOCIAL, FOOTER_SECTIONS } from "@/lib/site-config";
import { Logo } from "@/components/shared/logo";
import { Container } from "@/components/shared/container";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <Container size="wide" className="py-16">
        <div className="grid gap-12 lg:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-xs text-sm text-muted-foreground">{SITE.tagline}</p>
            <div className="flex gap-2">
              {[
                { icon: Twitter, href: SOCIAL.twitter, label: "Twitter" },
                { icon: Github, href: SOCIAL.github, label: "GitHub" },
              ].map(({ icon: Icon, href, label }) => (
                <a
                  key={label}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`${SITE.name} on ${label}`}
                  className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {FOOTER_SECTIONS.map((section) => (
            <div key={section.title}>
              {/* Not a heading — navigation labels (keeps the page's heading count lean). */}
              <p className="text-sm font-semibold text-foreground">{section.title}</p>
              <ul className="mt-4 space-y-2.5">
                {section.links.map((link) => (
                  <li key={link.label}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-primary"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-border pt-8 sm:flex-row">
          <p className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} {SITE.name}. All rights reserved.
          </p>
          <p className="text-sm text-muted-foreground">
            Product of{" "}
            <a
              href="https://toshiconsulting.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-foreground/80 underline-offset-2 hover:text-primary hover:underline"
            >
              Toshi Consulting Services Pvt. Ltd
            </a>
          </p>
        </div>
      </Container>
    </footer>
  );
}
