"use client";

import Link from "next/link";
import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import {
  ArrowRight,
  Sparkles,
  UploadCloud,
  FileText,
  Image as ImageIcon,
  Film,
  Music,
  Star,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { FEATURED_TOOLS } from "@/lib/tools-registry";

const floatingCards = [
  { icon: FileText, label: "Merge PDF", className: "left-[1%] top-[20%]", color: "from-rose-500 to-orange-500", delay: 0.1 },
  { icon: ImageIcon, label: "Convert Image", className: "right-[1%] top-[14%]", color: "from-cyan-500 to-blue-500", delay: 0.25 },
  { icon: Film, label: "Video → MP4", className: "left-[5%] bottom-[16%]", color: "from-violet-500 to-fuchsia-500", delay: 0.4 },
  { icon: Music, label: "Audio Converter", className: "right-[4%] bottom-[12%]", color: "from-emerald-500 to-teal-500", delay: 0.55 },
];

const avatarColors = [
  "from-rose-500 to-orange-500",
  "from-violet-500 to-fuchsia-600",
  "from-cyan-500 to-sky-600",
  "from-emerald-500 to-teal-600",
  "from-amber-400 to-yellow-500",
];

// Spring-driven word-by-word headline reveal.
const headlineContainer = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.1 } },
};
const headlineWord = {
  hidden: { opacity: 0, y: 40, rotate: -6, scale: 0.85 },
  show: {
    opacity: 1,
    y: 0,
    rotate: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 320, damping: 18 },
  },
} as const;

export function Hero() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });

  // Scroll-linked parallax: background drifts up, blobs separate, content lifts + fades.
  const bgY = useTransform(scrollYProgress, [0, 1], [0, 140]);
  const blobsY = useTransform(scrollYProgress, [0, 1], [0, -90]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 70]);
  const contentOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <section ref={ref} className="relative overflow-hidden pt-20 pb-28 sm:pt-28 lg:pt-32">
      {/* ── Colourful animated blob background ─────────────────── */}
      <motion.div style={{ y: bgY }} className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-white via-white to-white" />
        <motion.div style={{ y: blobsY }} className="absolute inset-0">
          <div className="absolute left-[6%] top-[12%] h-72 w-72 bg-rose-400/40 blur-[90px] animate-blob" />
          <div className="absolute right-[8%] top-[8%] h-80 w-80 bg-cyan-400/40 blur-[100px] animate-blob [animation-delay:-3s]" />
          <div className="absolute left-[38%] top-[2%] h-72 w-72 bg-amber-300/40 blur-[90px] animate-blob [animation-delay:-6s]" />
          <div className="absolute left-[20%] bottom-[6%] h-80 w-80 bg-violet-500/35 blur-[110px] animate-blob [animation-delay:-9s]" />
          <div className="absolute right-[24%] bottom-[2%] h-72 w-72 bg-emerald-400/35 blur-[100px] animate-blob [animation-delay:-12s]" />
        </motion.div>
        <div className="absolute inset-0 bg-grid opacity-40" />
      </motion.div>

      {/* ── Bouncy floating tool bubbles (desktop) ─────────────── */}
      {floatingCards.map((card) => (
        <motion.div
          key={card.label}
          initial={{ opacity: 0, scale: 0.5, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: card.delay, type: "spring", stiffness: 260, damping: 14 }}
          className={`absolute hidden xl:block ${card.className}`}
        >
          <div className="animate-bounce-slow">
            <div className="glass flex items-center gap-2.5 rounded-2xl px-4 py-3 shadow-card-hover">
              <span className={`grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br ${card.color} text-white shadow-md`}>
                <card.icon className="h-4 w-4" />
              </span>
              <span className="text-sm font-semibold">{card.label}</span>
            </div>
          </div>
        </motion.div>
      ))}

      <motion.div
        style={{ y: contentY, opacity: contentOpacity }}
        className="mx-auto max-w-4xl px-5 text-center sm:px-6"
      >
        {/* Social-proof pill */}
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 18 }}
          className="mx-auto mb-7 inline-flex items-center gap-3 rounded-full border-2 border-white bg-white/80 py-1.5 pl-2 pr-4 shadow-card backdrop-blur"
        >
          <div className="flex -space-x-2">
            {avatarColors.map((c, i) => (
              <span key={i} className={`h-6 w-6 rounded-full bg-gradient-to-br ${c} ring-2 ring-white`} />
            ))}
          </div>
          <span className="flex items-center gap-1.5 text-sm">
            <span className="flex items-center gap-0.5 text-amber-400">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-3.5 w-3.5 fill-current" />
              ))}
            </span>
            <span className="font-semibold text-foreground">Loved by 50,000+ creators</span>
          </span>
        </motion.div>

        {/* Headline — springy word-by-word */}
        <motion.h1
          variants={headlineContainer}
          initial="hidden"
          animate="show"
          className="font-display text-[2.9rem] font-extrabold leading-[1.02] tracking-tight sm:text-6xl lg:text-[5rem]"
        >
          {/* Real spaces between words so the H1 reads as proper text for SEO. */}
          <motion.span variants={headlineWord} className="inline-block">
            Transform
          </motion.span>{" "}
          <motion.span variants={headlineWord} className="inline-block text-rainbow">
            Any File
          </motion.span>{" "}
          <br />
          <motion.span variants={headlineWord} className="inline-block">
            In
          </motion.span>{" "}
          <motion.span variants={headlineWord} className="inline-block">
            Seconds
          </motion.span>{" "}
          <motion.span variants={headlineWord} className="inline-block" aria-hidden="true">
            <span className="inline-block animate-wiggle">✨</span>
          </motion.span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mx-auto mt-7 max-w-2xl text-lg text-muted-foreground sm:text-xl"
        >
          Transform any file in seconds. Convert, compress, edit, protect and optimize PDFs,
          images, videos, audio and documents with 100+ free online tools — no software to install.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 280, damping: 18, delay: 0.6 }}
          className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row"
        >
          <Button asChild variant="gradient" size="xl" className="group w-full glow-fun sm:w-auto">
            <Link href="/tools">
              Start Converting Free
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="xl" className="w-full border-2 sm:w-auto">
            <Link href="/tools">
              <Sparkles className="h-4 w-4" /> Explore 100+ Tools
            </Link>
          </Button>
        </motion.div>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.8 }}
          className="mt-4 flex items-center justify-center gap-1.5 text-sm text-muted-foreground"
        >
          <Lock className="h-3.5 w-3.5 text-primary" />
          Free to use · Sign in to download your results
        </motion.p>

        {/* Upload demo */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 18, delay: 0.7 }}
          className="relative mx-auto mt-14 max-w-2xl"
        >
          <div className="absolute -inset-x-6 -bottom-6 top-2 -z-10 rounded-[2rem] bg-fun-gradient opacity-25 blur-2xl" />

          <div className="gradient-border p-1.5 shadow-card-hover">
            <Link
              href="/tools"
              className="group flex flex-col items-center gap-3 rounded-[calc(var(--radius)-2px)] border-2 border-dashed border-border bg-white/85 px-6 py-11 backdrop-blur transition-colors hover:border-primary/50 hover:bg-primary/[0.03]"
            >
              <span className="grid h-16 w-16 place-items-center rounded-2xl bg-fun-gradient bg-[length:200%_200%] shadow-glow transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
                <UploadCloud className="h-7 w-7 text-white" />
              </span>
              <span className="text-base font-bold">Drop a file to get started</span>
              <span className="text-sm text-muted-foreground">
                or pick from <span className="font-semibold text-primary">100+ tools</span> — it&apos;s
                completely free to try
              </span>
            </Link>
          </div>

          {/* Quick tool chips */}
          <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
            {FEATURED_TOOLS.slice(0, 6).map((tool, i) => (
              <motion.div
                key={tool.slug}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 16, delay: 0.9 + i * 0.06 }}
              >
                <Link
                  href={`/${tool.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-full border-2 border-border bg-white px-3.5 py-1.5 text-sm font-semibold text-muted-foreground shadow-sm transition-all hover:-translate-y-1 hover:border-primary/50 hover:text-foreground hover:shadow-card"
                >
                  <tool.icon className="h-3.5 w-3.5" />
                  {tool.title}
                </Link>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </motion.div>
    </section>
  );
}
