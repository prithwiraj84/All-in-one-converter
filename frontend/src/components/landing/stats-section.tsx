"use client";

import { Sparkles } from "lucide-react";
import { Container } from "@/components/shared/container";
import { RevealGroup, revealItem } from "@/components/shared/reveal";
import { AnimatedCounter } from "@/components/shared/animated-counter";
import { HERO_STATS } from "@/lib/site-config";
import { motion } from "framer-motion";

export function StatsSection() {
  return (
    <section className="relative border-y border-border/70 py-16 sm:py-20">
      {/* Subtle gradient + grid band */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute inset-0 bg-surface/60" />
        <div className="absolute inset-0 bg-grid opacity-40" />
        <div className="absolute left-1/2 top-1/2 h-[320px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-gradient opacity-[0.07] blur-[120px]" />
      </div>

      <Container size="wide">
        {/* Eyebrow */}
        <div className="mb-10 flex justify-center sm:mb-14">
          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-white/60 px-4 py-1.5 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Trusted worldwide
          </span>
        </div>

        {/* Counters grid */}
        <RevealGroup className="grid grid-cols-2 gap-y-12 gap-x-6 text-center md:grid-cols-4">
          {HERO_STATS.map((stat) => (
            <motion.div
              key={stat.label}
              variants={revealItem}
              className="flex flex-col items-center"
            >
              <AnimatedCounter
                value={stat.value}
                prefix={stat.prefix}
                suffix={stat.suffix}
                decimals={Number.isInteger(stat.value) ? 0 : 1}
                className="font-display text-4xl font-bold tracking-tight text-gradient sm:text-5xl lg:text-6xl"
              />
              <span className="mt-2.5 text-sm font-medium text-muted-foreground sm:text-base">
                {stat.label}
              </span>
            </motion.div>
          ))}
        </RevealGroup>
      </Container>
    </section>
  );
}
