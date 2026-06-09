"use client";

import { motion, type Variants } from "framer-motion";
import type { ReactNode } from "react";

const variantsMap: Record<string, Variants> = {
  up: {
    hidden: { opacity: 0, y: 28 },
    show: { opacity: 1, y: 0 },
  },
  down: {
    hidden: { opacity: 0, y: -28 },
    show: { opacity: 1, y: 0 },
  },
  left: {
    hidden: { opacity: 0, x: 28 },
    show: { opacity: 1, x: 0 },
  },
  right: {
    hidden: { opacity: 0, x: -28 },
    show: { opacity: 1, x: 0 },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.94 },
    show: { opacity: 1, scale: 1 },
  },
};

interface RevealProps {
  children: ReactNode;
  direction?: keyof typeof variantsMap;
  delay?: number;
  className?: string;
  once?: boolean;
}

/** Scroll-triggered reveal animation wrapper. */
export function Reveal({
  children,
  direction = "up",
  delay = 0,
  className,
  once = true,
}: RevealProps) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      variants={variantsMap[direction]}
    >
      {children}
    </motion.div>
  );
}

/** Staggered container — children should use the `RevealItem` variants. */
export function RevealGroup({
  children,
  className,
  stagger = 0.1,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  stagger?: number;
  once?: boolean;
}) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once, margin: "-80px" }}
      variants={{
        hidden: {},
        show: { transition: { staggerChildren: stagger } },
      }}
    >
      {children}
    </motion.div>
  );
}

export const revealItem: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] } },
};
