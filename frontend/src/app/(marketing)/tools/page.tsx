import type { Metadata } from "next";
import { Sparkles } from "lucide-react";
import { TOOLS, CATEGORIES } from "@/lib/tools-registry";
import { absoluteUrl } from "@/lib/utils";
import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { Badge } from "@/components/ui/badge";
import { ToolsBrowser } from "@/components/tools/tools-browser";

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
  return (
    <>
      {/* ── Hero header ─────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute left-1/2 top-[-20%] h-[480px] w-[900px] -translate-x-1/2 rounded-full bg-brand-gradient opacity-[0.1] blur-[120px]" />
          <div className="absolute inset-0 bg-grid opacity-50" />
        </div>

        <Container size="wide" className="py-8 text-center sm:py-12">
          <Reveal>
            <Badge variant="secondary" className="mb-4 gap-1.5 sm:mb-5">
              <Sparkles className="h-3.5 w-3.5" />
              Every tool, free forever
            </Badge>
          </Reveal>

          <Reveal delay={0.05}>
            <h1 className="font-display text-3xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
              All your file tools,
              <br className="hidden sm:block" />{" "}
              <span className="text-gradient">in one place</span>
            </h1>
          </Reveal>

          <Reveal delay={0.1}>
            <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:mt-5 sm:text-lg">
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

      <ToolsBrowser />
    </>
  );
}
