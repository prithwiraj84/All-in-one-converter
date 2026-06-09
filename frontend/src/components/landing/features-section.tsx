"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/shared/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { RevealGroup, revealItem } from "@/components/shared/reveal";
import { cn } from "@/lib/utils";
import { CATEGORIES, toolsByCategory } from "@/lib/tools-registry";
import type { CategoryInfo } from "@/lib/tools-registry";
import type { ToolCategory } from "@/lib/types";

/** Category keys shown on the homepage, in display order. */
const FEATURE_KEYS: ToolCategory[] = ["pdf", "image", "video", "audio", "document", "ai"];

const FEATURE_CATEGORIES: CategoryInfo[] = FEATURE_KEYS.map(
  (key) => CATEGORIES.find((c) => c.key === key)!,
);

export function FeaturesSection() {
  return (
    <section id="features" className="relative overflow-hidden py-20 sm:py-24">
      {/* soft background accents */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute right-[8%] top-[12%] h-72 w-72 rounded-full bg-secondary/10 blur-3xl" />
        <div className="absolute left-[6%] bottom-[10%] h-72 w-72 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <Container size="wide">
        <SectionHeading
          eyebrow="Everything you need"
          title={
            <>
              One platform for <span className="text-gradient">every file</span>
            </>
          }
          description="From PDFs and images to video, audio and AI-powered tools — handle any format in one fast, secure workspace built for the way you work."
        />

        <RevealGroup
          className="mt-14 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
          stagger={0.08}
        >
          {FEATURE_CATEGORIES.map((category) => {
            const Icon = category.icon;
            const count = toolsByCategory(category.key).length;

            return (
              <motion.div key={category.key} variants={revealItem}>
                <Link
                  href="/tools"
                  className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-card-hover"
                >
                  {/* hover glow accent */}
                  <span className="pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full bg-brand-gradient opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20" />

                  {/* gradient icon tile */}
                  <div
                    className={cn(
                      "grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br text-white shadow-sm transition-transform duration-300 group-hover:scale-110",
                      category.gradient,
                    )}
                  >
                    <Icon className="h-6 w-6" strokeWidth={2.2} />
                  </div>

                  <div className="space-y-1.5">
                    <h3 className="font-display text-lg font-semibold leading-tight tracking-tight">
                      {category.label}
                    </h3>
                    <p className="text-sm leading-relaxed text-muted-foreground">
                      {category.description}
                    </p>
                  </div>

                  <div className="mt-auto flex items-center justify-between border-t border-border/60 pt-4">
                    <span className={cn("text-sm font-semibold", category.accent)}>
                      {count} {count === 1 ? "tool" : "tools"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-muted-foreground transition-colors group-hover:text-primary">
                      Explore
                      <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
                  </div>
                </Link>
              </motion.div>
            );
          })}
        </RevealGroup>
      </Container>
    </section>
  );
}
