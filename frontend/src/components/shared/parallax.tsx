"use client";

import { useRef, type ReactNode } from "react";
import { motion, useScroll, useTransform, useSpring, type MotionValue } from "framer-motion";

interface ParallaxProps {
  children: ReactNode;
  /** Pixels of travel across the scroll range. Positive = moves down as you scroll. */
  offset?: number;
  className?: string;
}

/**
 * Scroll-linked vertical parallax. The element drifts by `offset` px as it
 * travels through the viewport, smoothed with a spring for a fluid, playful feel.
 */
export function Parallax({ children, offset = 80, className }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start end", "end start"],
  });
  const raw = useTransform(scrollYProgress, [0, 1], [-offset, offset]);
  const y = useSpring(raw, { stiffness: 80, damping: 20, mass: 0.4 });

  return (
    <motion.div ref={ref} style={{ y }} className={className}>
      {children}
    </motion.div>
  );
}

/**
 * Returns a scroll-progress MotionValue (0→1) for the whole page, smoothed.
 * Handy for top-of-page hero effects.
 */
export function usePageScroll(): MotionValue<number> {
  const { scrollYProgress } = useScroll();
  return useSpring(scrollYProgress, { stiffness: 90, damping: 24, mass: 0.4 });
}
