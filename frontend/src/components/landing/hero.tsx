"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Sparkles, UploadCloud, FileText, Image as ImageIcon, Film, Music, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FEATURED_TOOLS } from "@/lib/tools-registry";

const floatingCards = [
  { icon: FileText, label: "Merge PDF", className: "left-[2%] top-[18%]", delay: 0, anim: "animate-float" },
  { icon: ImageIcon, label: "Convert Image", className: "right-[2%] top-[12%]", delay: 0.4, anim: "animate-float-slow" },
  { icon: Film, label: "Video → MP4", className: "left-[6%] bottom-[14%]", delay: 0.8, anim: "animate-float-slow" },
  { icon: Music, label: "Audio Converter", className: "right-[5%] bottom-[10%]", delay: 1.2, anim: "animate-float" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 lg:pt-28">
      {/* Background glow + grid */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-[-10%] h-[640px] w-[1100px] -translate-x-1/2 rounded-full bg-brand-gradient opacity-[0.12] blur-[120px] animate-pulse-glow" />
        <div className="absolute inset-0 bg-grid opacity-60" />
        <div className="absolute left-[12%] top-[30%] h-72 w-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="absolute right-[10%] top-[20%] h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />
      </div>

      {/* Floating tool cards (desktop only) */}
      {floatingCards.map((card) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: card.delay, duration: 0.6 }}
          className={`absolute hidden xl:flex ${card.className} ${card.anim}`}
        >
          <div className="glass flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-card">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient text-white">
              <card.icon className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium">{card.label}</span>
          </div>
        </motion.div>
      ))}

      <div className="mx-auto max-w-4xl px-5 text-center sm:px-6">
        {/* Eyebrow pill */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-7 inline-flex items-center gap-2 rounded-full border border-border bg-white/60 px-4 py-1.5 text-sm shadow-sm backdrop-blur"
        >
          <span className="flex items-center gap-0.5 text-amber-500">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-3.5 w-3.5 fill-current" />
            ))}
          </span>
          <span className="font-medium text-foreground">Loved by 50,000+ users</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl"
        >
          Transform Any File
          <br />
          In <span className="text-gradient">Seconds</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
        >
          Convert, compress, edit, protect and optimize PDFs, images, videos, audio and documents
          using one intelligent platform.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button asChild variant="gradient" size="xl" className="w-full sm:w-auto">
            <Link href="/signup">
              Start Free <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="xl" className="w-full sm:w-auto">
            <Link href="/tools">
              <Sparkles className="h-4 w-4" /> Explore Tools
            </Link>
          </Button>
        </motion.div>

        {/* Upload demo */}
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.35 }}
          className="mx-auto mt-14 max-w-2xl"
        >
          <div className="gradient-border p-1.5 shadow-card-hover">
            <Link
              href="/tools"
              className="group flex flex-col items-center gap-3 rounded-[calc(var(--radius)-2px)] border-2 border-dashed border-border bg-surface/80 px-6 py-10 transition-colors hover:border-primary/50 hover:bg-primary/[0.03]"
            >
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-gradient bg-[length:200%_200%] shadow-glow transition-transform group-hover:scale-110">
                <UploadCloud className="h-6 w-6 text-white" />
              </span>
              <span className="text-base font-semibold">Drop a file to get started</span>
              <span className="text-sm text-muted-foreground">
                or pick from <span className="font-medium text-primary">100+ tools</span> — no signup required
              </span>
            </Link>
          </div>

          {/* Quick tool chips */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {FEATURED_TOOLS.slice(0, 6).map((tool) => (
              <Link
                key={tool.slug}
                href={`/${tool.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-1.5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground"
              >
                <tool.icon className="h-3.5 w-3.5" />
                {tool.title}
              </Link>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
