"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader } from "./loader";

const MIN_VISIBLE_MS = 450; // keep the loader up long enough to actually see it
const SAME_PATH_HIDE_MS = 700; // query-only navs (e.g. ?tab=) finish quickly
const SAFETY_MS = 12000; // force-hide if a navigation never resolves

/**
 * Global navigation loader. Uses only `usePathname` (NOT `useSearchParams`) so
 * it never forces marketing pages into dynamic/streamed rendering — important
 * for SEO, where a streamed page would show crawlers a "Loading…" shell. The
 * loader is triggered by intercepting internal link clicks; cross-route
 * navigations clear it on the pathname change, and same-page `?tab=` switches
 * clear it on a short timer.
 */
export function NavProgress() {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const startRef = useRef(0);
  const samePathRef = useRef(false);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const hideRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  // Start: catch internal link clicks in the capture phase (before Next's Link).
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (
        e.defaultPrevented ||
        e.button !== 0 ||
        e.metaKey ||
        e.ctrlKey ||
        e.shiftKey ||
        e.altKey
      )
        return;

      const anchor = (e.target as HTMLElement | null)?.closest?.("a");
      if (
        !anchor ||
        anchor.hasAttribute("download") ||
        anchor.getAttribute("target") === "_blank"
      )
        return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;
      // Skip only if it's the exact same URL (same path AND query).
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;

      clearTimeout(hideRef.current);
      clearTimeout(safetyRef.current);
      samePathRef.current = url.pathname === window.location.pathname; // query-only nav
      startRef.current = Date.now();
      setActive(true);

      // Same-path (?tab=) navs don't change pathname, so hide on a short timer.
      if (samePathRef.current) {
        hideRef.current = setTimeout(() => setActive(false), SAME_PATH_HIDE_MS);
      }
      safetyRef.current = setTimeout(() => setActive(false), SAFETY_MS);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // End (cross-route): hide once the pathname actually changes.
  useEffect(() => {
    if (!active || samePathRef.current) return;
    clearTimeout(safetyRef.current);
    const elapsed = Date.now() - startRef.current;
    hideRef.current = setTimeout(
      () => setActive(false),
      Math.max(0, MIN_VISIBLE_MS - elapsed),
    );
    return () => clearTimeout(hideRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  return (
    <AnimatePresence>
      {active && (
        <>
          {/* top gradient progress bar */}
          <motion.div
            key="nav-bar"
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: 0.92 }}
            exit={{ scaleX: 1, opacity: 0 }}
            transition={{ scaleX: { duration: 2.4, ease: "easeOut" }, opacity: { duration: 0.25 } }}
            style={{ transformOrigin: "0% 50%" }}
            className="fixed inset-x-0 top-0 z-[120] h-1 bg-rainbow-gradient bg-[length:200%_100%] animate-rainbow-pan"
          />
          {/* branded loader pill */}
          <motion.div
            key="nav-pill"
            initial={{ opacity: 0, y: -12, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -12, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 320, damping: 22 }}
            className="fixed left-1/2 top-4 z-[120] -translate-x-1/2"
          >
            <div className="glass flex items-center gap-2.5 rounded-full py-1.5 pl-1.5 pr-4 shadow-card-hover">
              <Loader size={26} />
              <span className="text-sm font-semibold text-foreground">Loading…</span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
