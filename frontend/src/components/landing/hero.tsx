"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Star,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FEATURED_TOOLS } from "@/lib/tools-registry";

const floatingCards = [
  { icon: FileText, label: "Merge PDF", className: "left-[1%] top-[20%]", delay: 0.1, anim: "animate-float" },
  { icon: ImageIcon, label: "Convert Image", className: "right-[1%] top-[14%]", delay: 0.4, anim: "animate-float-slow" },
  { icon: Film, label: "Video → MP4", className: "left-[5%] bottom-[16%]", delay: 0.7, anim: "animate-float-slow" },
  { icon: Music, label: "Audio Converter", className: "right-[4%] bottom-[12%]", delay: 1.0, anim: "animate-float" },
];

const avatarColors = [
  "from-blue-500 to-indigo-600",
  "from-violet-500 to-purple-600",
  "from-cyan-500 to-sky-600",
  "from-pink-500 to-rose-600",
  "from-amber-500 to-orange-600",
];

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-16 pb-24 sm:pt-24 lg:pt-28">
      {/* ── Light gradient-mesh background ─────────────────────── */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        {/* base vertical wash that fades into the page white */}
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.05] via-white to-white" />
        {/* soft brand halo */}
        <div className="absolute left-1/2 top-[-14%] h-[680px] w-[1200px] -translate-x-1/2 rounded-full bg-brand-gradient opacity-[0.10] blur-[130px] animate-pulse-glow" />
        {/* colored mesh blobs */}
        <div className="absolute left-[4%] top-[22%] h-80 w-80 rounded-full bg-accent/25 blur-[90px] animate-float-slow" />
        <div className="absolute right-[6%] top-[12%] h-80 w-80 rounded-full bg-secondary/25 blur-[90px] animate-float" />
        <div className="absolute left-[34%] bottom-[2%] h-72 w-72 rounded-full bg-primary/15 blur-[100px]" />
        {/* faint grid, masked at the top */}
        <div className="absolute inset-0 bg-grid opacity-50" />
      </div>

      {/* ── Floating tool cards (desktop) ──────────────────────── */}
      {floatingCards.map((card) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: card.delay, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className={`absolute hidden xl:flex ${card.className} ${card.anim}`}
        >
          <div className="glass flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-card-hover">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient text-white shadow-glow">
              <card.icon className="h-4 w-4" />
            </span>
            <span className="text-sm font-medium">{card.label}</span>
          </div>
        </motion.div>
      ))}

      <div className="mx-auto max-w-4xl px-5 text-center sm:px-6">
        {/* Social-proof pill with faux avatars */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto mb-7 inline-flex items-center gap-3 rounded-full border border-border bg-white/70 py-1.5 pl-2 pr-4 shadow-sm backdrop-blur"
        >
          <div className="flex -space-x-2">
            {avatarColors.map((c, i) => (
              <span
                key={i}
                className={`h-6 w-6 rounded-full bg-gradient-to-br ${c} ring-2 ring-white`}
              />
            ))}
          </div>
          <span className="flex items-center gap-1.5 text-sm">
            <span className="flex items-center gap-0.5 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-current" />
              ))}
            </span>
            <span className="font-medium text-foreground">Loved by 50,000+ users</span>
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="font-display text-[2.6rem] font-bold leading-[1.04] tracking-tight sm:text-6xl lg:text-7xl"
        >
          Transform <span className="text-gradient">Any File</span>
          <br />
          In Seconds
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

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.35 }}
          className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground"
        >
          <ShieldCheck className="h-4 w-4 text-primary" />
          No signup required · Files deleted automatically
        </motion.p>

        {/* Upload demo */}
        <motion.div
          initial={{ opacity: 0, y: 32, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="relative mx-auto mt-14 max-w-2xl"
        >
          {/* glow underlay */}
          <div className="absolute -inset-x-6 -bottom-6 top-2 -z-10 rounded-[2rem] bg-brand-gradient opacity-20 blur-2xl" />

          <div className="gradient-border p-1.5 shadow-card-hover">
            <Link
              href="/tools"
              className="group flex flex-col items-center gap-3 rounded-[calc(var(--radius)-2px)] border-2 border-dashed border-border bg-white/80 px-6 py-11 backdrop-blur transition-colors hover:border-primary/50 hover:bg-primary/[0.03]"
            >
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-brand-gradient bg-[length:200%_200%] shadow-glow transition-transform duration-300 group-hover:scale-110">
                <UploadCloud className="h-7 w-7 text-white" />
              </span>
              <span className="text-base font-semibold">Drop a file to get started</span>
              <span className="text-sm text-muted-foreground">
                or pick from <span className="font-medium text-primary">100+ tools</span> — it&apos;s
                completely free
              </span>
            </Link>
          </div>

          {/* Quick tool chips */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            {FEATURED_TOOLS.slice(0, 6).map((tool) => (
              <Link
                key={tool.slug}
                href={`/${tool.slug}`}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-white px-3.5 py-1.5 text-sm font-medium text-muted-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:text-foreground hover:shadow-card"
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
