"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getTool, getCategory, type Tool } from "@/lib/tools-registry";
import { cn } from "@/lib/utils";
import { ToolDemo } from "./tool-demos";

const SHOWCASE_SLUGS = [
  "merge-pdf",
  "split-pdf",
  "compress-pdf",
  "pdf-to-text",
  "pdf-to-word",
  "word-to-pdf",
  "image-converter",
  "video-converter",
] as const;

const SHOWCASE_TOOLS: Tool[] = SHOWCASE_SLUGS.map((slug) => getTool(slug)).filter(
  (tool): tool is Tool => Boolean(tool),
);

export function ShowcaseSection() {
  const [activeIndex, setActiveIndex] = useState(0);
  const activeTool = SHOWCASE_TOOLS[activeIndex];
  const activeCategory = getCategory(activeTool.category);

  return (
    <section className="relative overflow-hidden py-16 sm:py-24">
      {/* Background accents */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-[8%] top-[12%] h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />
        <div className="absolute left-[6%] bottom-[10%] h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
        <div className="absolute inset-0 bg-grid opacity-40" />
      </div>

      <Container size="wide">
        <SectionHeading
          eyebrow="See it in action"
          title="One workspace for every file"
          description="Pick a tool to preview exactly what it does. Same clean, fast experience across PDFs, documents, images and video."
        />

        <div className="mt-12 grid gap-6 lg:mt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-start lg:gap-8">
          {/* Left: selectable tool list */}
          <div className="flex flex-col gap-2.5">
            {SHOWCASE_TOOLS.map((tool, index) => {
              const isActive = index === activeIndex;
              const category = getCategory(tool.category);
              const Icon = tool.icon;
              return (
                <button
                  key={tool.slug}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  aria-pressed={isActive}
                  className={cn(
                    "group flex items-center gap-4 rounded-2xl border p-4 text-left transition-all",
                    isActive
                      ? "border-primary/30 bg-primary/5 shadow-card"
                      : "border-border bg-white hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-card",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm transition-transform",
                      category.gradient,
                      isActive ? "scale-105 shadow-glow" : "group-hover:scale-105",
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-display text-base font-semibold tracking-tight text-foreground">
                      {tool.title}
                    </span>
                    <span className="mt-0.5 line-clamp-1 block text-sm text-muted-foreground">
                      {tool.description}
                    </span>
                  </span>
                  <ArrowRight
                    className={cn(
                      "h-4 w-4 shrink-0 transition-all",
                      isActive
                        ? "translate-x-0 text-primary opacity-100"
                        : "-translate-x-1 text-muted-foreground opacity-0 group-hover:translate-x-0 group-hover:opacity-100",
                    )}
                  />
                </button>
              );
            })}
          </div>

          {/* Right: animated preview panel */}
          <div className="relative min-h-[460px] overflow-hidden rounded-2xl border border-border bg-white shadow-card-hover lg:min-h-[520px]">
            {/* Gradient halo tied to category */}
            <div
              className={cn(
                "pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gradient-to-br opacity-20 blur-3xl",
                activeCategory.gradient,
              )}
            />

            <AnimatePresence mode="wait">
              <motion.div
                key={activeTool.slug}
                initial={{ opacity: 0, x: 24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -24 }}
                transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                className="flex h-full flex-col p-7 sm:p-9"
              >
                {/* Header: title + category */}
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    {activeTool.title}
                  </h3>
                  <Badge variant="secondary" className="shrink-0 gap-1.5">
                    <activeCategory.icon className="h-3.5 w-3.5" />
                    {activeCategory.label}
                  </Badge>
                </div>

                {/* Animated demo — grows to fill the panel (no desktop gap) */}
                <div className="relative mt-5 min-h-[170px] flex-1 overflow-hidden rounded-xl border border-border bg-gradient-to-br from-surface to-white">
                  <div className="pointer-events-none absolute inset-0 bg-grid opacity-40" />
                  <div className="absolute inset-2.5">
                    <ToolDemo slug={activeTool.slug} />
                  </div>
                </div>

                {/* Full description (restored) */}
                <p className="mt-5 text-[15px] leading-relaxed text-muted-foreground">
                  {activeTool.longDescription}
                </p>

                {/* Open button */}
                <div className="pt-6">
                  <Button asChild variant="gradient" size="lg" className="w-full sm:w-auto">
                    <Link href={`/${activeTool.slug}`}>
                      Open {activeTool.title}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </Container>
    </section>
  );
}
