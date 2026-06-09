import Link from "next/link";
import { ArrowRight, Sparkles, Zap } from "lucide-react";
import { Container } from "@/components/shared/container";
import { Reveal } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";

export function CtaSection() {
  return (
    <Container size="wide" className="py-16">
      <Reveal direction="scale">
        <div className="relative overflow-hidden rounded-3xl bg-brand-gradient bg-[length:200%_200%] px-6 py-16 text-center text-white shadow-glow-lg animate-gradient-shift sm:px-12 sm:py-20">
          {/* Grid + glow overlays */}
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-grid opacity-[0.12]" />
            <div className="absolute -left-16 top-[-20%] h-72 w-72 rounded-full bg-white/20 blur-3xl" />
            <div className="absolute -right-10 bottom-[-25%] h-80 w-80 rounded-full bg-accent/30 blur-3xl" />
          </div>

          {/* Content */}
          <div className="relative mx-auto max-w-2xl">
            {/* Eyebrow badge */}
            <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-1.5 text-sm font-medium backdrop-blur">
              <Zap className="h-3.5 w-3.5" />
              Start in seconds
            </span>

            {/* Headline */}
            <h2 className="font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl">
              Ready to transform your files?
            </h2>

            {/* Subtext */}
            <p className="mx-auto mt-5 max-w-xl text-lg text-white/85">
              Join 50,000+ people using one intelligent platform to convert, compress and protect
              their PDFs, images, videos and more. No signup required to start.
            </p>

            {/* Buttons */}
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                asChild
                size="xl"
                className="w-full bg-white text-primary hover:bg-white/90 sm:w-auto"
              >
                <Link href="/signup">
                  Start Free <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                size="xl"
                className="w-full border border-white/40 bg-white/10 text-white hover:bg-white/20 sm:w-auto"
              >
                <Link href="/tools">
                  <Sparkles className="h-4 w-4" /> Explore Tools
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </Reveal>
    </Container>
  );
}
