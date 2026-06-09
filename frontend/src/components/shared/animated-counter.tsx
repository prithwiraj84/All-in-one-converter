"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useInView } from "framer-motion";

interface AnimatedCounterProps {
  value: number;
  prefix?: string;
  suffix?: string;
  duration?: number;
  decimals?: number;
  className?: string;
}

/** Counts up to `value` once it scrolls into view. */
export function AnimatedCounter({
  value,
  prefix = "",
  suffix = "",
  duration = 2,
  decimals,
  className,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const [display, setDisplay] = useState(0);

  const places = decimals ?? (Number.isInteger(value) ? 0 : 1);

  useEffect(() => {
    if (!inView) return;
    const controls = animate(0, value, {
      duration,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setDisplay(v),
    });
    return () => controls.stop();
  }, [inView, value, duration]);

  const formatted =
    display >= 1000
      ? new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(display)
      : display.toFixed(places);

  return (
    <span ref={ref} className={className}>
      {prefix}
      {formatted}
      {suffix}
    </span>
  );
}
