"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { RevealGroup, revealItem } from "@/components/shared/reveal";
import { Button } from "@/components/ui/button";
import { TOOLS, getCategory, getTool, type Tool } from "@/lib/tools-registry";
import { cn } from "@/lib/utils";

/** The tools most people come for — one click each, across every category. */
const POPULAR_SLUGS = [
  "merge-pdf",
  "compress-pdf",
  "pdf-to-word",
  "word-to-pdf",
  "split-pdf",
  "image-converter",
  "compress-image",
  "background-remover",
  "qr-code-generator",
  "video-converter",
  "audio-to-text",
  "document-translator",
];

const POPULAR: Tool[] = POPULAR_SLUGS.map((slug) => getTool(slug)).filter((t): t is Tool => Boolean(t));

export function PopularToolsSection() {
  return (
    <section id="popular-tools" className="relative overflow-hidden py-16 sm:py-24">
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-[8%] top-[10%] h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />
        <div className="absolute inset-0 bg-grid opacity-40" />
      </div>

      <Container size="wide">
        <SectionHeading
          eyebrow="Most popular"
          title={
            <>
              Start with a <span className="text-gradient">popular tool</span>
            </>
          }
          description="Jump straight into the tools people use most. Free to try — nothing to install."
        />

        <RevealGroup
          className="mt-10 grid grid-cols-2 gap-3 sm:mt-14 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 lg:gap-5"
          stagger={0.05}
        >
          {POPULAR.map((tool) => {
            const category = getCategory(tool.category);
            const Icon = tool.icon;
            return (
              <motion.div key={tool.slug} variants={revealItem}>
                <Link
                  href={`/${tool.slug}`}
                  className="group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-4 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-card-hover sm:p-5"
                >
                  <span className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-brand-gradient opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20" />
                  <div className="flex items-start justify-between">
                    <span
                      className={cn(
                        "grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm transition-transform duration-300 group-hover:scale-110 sm:h-12 sm:w-12",
                        category.gradient,
                      )}
                    >
                      <Icon className="h-5 w-5 sm:h-6 sm:w-6" strokeWidth={2.2} />
                    </span>
                    <ArrowUpRight className="hidden h-4 w-4 text-muted-foreground opacity-0 transition-all duration-300 group-hover:opacity-100 group-hover:text-primary sm:block" />
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-display text-[15px] font-semibold leading-snug tracking-tight sm:text-base">
                      {tool.title}
                    </h3>
                    {/* Descriptions from tablet up; phones get a clean two-column grid of names. */}
                    <p className="mt-1 hidden text-sm leading-relaxed text-muted-foreground sm:line-clamp-2">
                      {tool.description}
                    </p>
                  </div>
                  <span className={cn("mt-auto text-xs font-semibold", category.accent)}>{category.short}</span>
                </Link>
              </motion.div>
            );
          })}
        </RevealGroup>

        <div className="mt-8 text-center sm:mt-10">
          <Button asChild variant="outline" size="lg" className="w-full border-2 sm:w-auto">
            <Link href="/tools">
              Browse all {TOOLS.length} tools
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </Container>
    </section>
  );
}
