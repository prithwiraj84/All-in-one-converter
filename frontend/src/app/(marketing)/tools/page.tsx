import type { Metadata } from "next";
import { Fragment } from "react";
import { Sparkles } from "lucide-react";
import { TOOLS, CATEGORIES, toolsByCategory } from "@/lib/tools-registry";
import { absoluteUrl } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { Badge } from "@/components/ui/badge";
import { ToolCard } from "@/components/tools/tool-card";
import { AdUnit } from "@/components/ads/ad-unit";

export const metadata: Metadata = {
  title: "All Tools — 100+ Free File Tools",
  description:
    "Browse every file tool in one place — convert, compress, edit, protect and optimize PDFs, images, videos, audio, documents and more. 100% free, no signup, files auto-deleted.",
  alternates: { canonical: absoluteUrl("/tools") },
  openGraph: {
    title: "All Tools — 100+ Free File Tools",
    description:
      "Browse every file tool in one place — convert, compress, edit, protect and optimize PDFs, images, videos, audio and documents. Free and secure.",
    url: absoluteUrl("/tools"),
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "All Tools — 100+ Free File Tools",
    description:
      "Every file tool in one place — convert, compress, edit and optimize your files for free.",
  },
};

export default async function ToolsIndexPage() {
  const activeCategories = CATEGORIES.filter(
    (cat) => toolsByCategory(cat.key).length > 0,
  );

  return (
    <>
      {/* ── Hero header ─────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-20%] h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-brand-gradient opacity-[0.1] blur-[120px]" />
          <div className="absolute inset-0 bg-grid opacity-50" />
        </div>

        <Container size="wide" className="py-12 text-center">
          <Reveal>
            <Badge variant="secondary" className="mb-5 gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />
              Every tool, free forever
            </Badge>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              All your file tools,
              <br className="hidden sm:block" />{" "}
              <span className="text-gradient">in one place</span>
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-muted-foreground">
              Convert, compress, edit, protect and optimize PDFs, images, videos,
              audio and documents — free to try, no watermarks, sign in to
              download.
            </p>
          </Reveal>

          <Reveal delay={0.15}>
            <p className="mt-6 inline-flex items-center gap-2 rounded-full border border-border bg-white/60 px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur">
              <span className="font-semibold text-foreground">{TOOLS.length} tools</span>
              across
              <span className="font-semibold text-foreground">{CATEGORIES.length} categories</span>
            </p>
          </Reveal>
        </Container>
      </section>

      {/* ── Category sections ───────────────────────────────── */}
      {activeCategories.map((category, idx) => {
        const tools = toolsByCategory(category.key);
        const CategoryIcon = category.icon;

        return (
          <Fragment key={category.key}>
          <section
            id={category.key}
            className="scroll-mt-24 border-t border-border/60 py-16 first-of-type:border-t-0 sm:py-20"
          >
            <Container size="wide">
              <Reveal>
                <div className="flex items-start gap-4">
                  <span
                    className={cn(
                      "grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-card",
                      category.gradient,
                    )}
                  >
                    <CategoryIcon className="h-6 w-6" strokeWidth={2.2} />
                  </span>
                  <div>
                    <h2 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">
                      {category.label}
                    </h2>
                    <p className="mt-1 max-w-2xl text-muted-foreground">
                      {category.description}
                    </p>
                  </div>
                </div>
              </Reveal>

              <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {tools.map((tool) => (
                  <ToolCard key={tool.slug} tool={tool} />
                ))}
              </div>
            </Container>
          </section>
          {idx === 1 && (
            <Container size="wide" className="pb-2">
              <AdUnit minHeight={110} />
            </Container>
          )}
          </Fragment>
        );
      })}
    </>
  );
}
