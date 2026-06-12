"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader } from "./loader";

const MIN_VISIBLE_MS = 450; // keep the loader up long enough to actually see it
const SAFETY_MS = 12000; // force-hide if a navigation never resolves

/**
 * Global navigation loader. Next.js `loading.tsx` only shows while a route
 * segment suspends — static pages render instantly and never trigger it, and
 * query-only navigations (e.g. dashboard `?tab=` switches) don't either. This
 * intercepts internal link clicks so the branded loader appears on every
 * navigation, then clears it when the path OR query string actually changes.
 */
export function NavProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const startRef = useRef(0);
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
      // Skip only if it's the exact same URL (same path AND query). A changed
      // ?tab= counts as a navigation worth showing the loader for.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      )
        return;

      clearTimeout(hideRef.current);
      clearTimeout(safetyRef.current);
      startRef.current = Date.now();
      setActive(true);
      safetyRef.current = setTimeout(() => setActive(false), SAFETY_MS);
    }

    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  // End: once the path or query actually changes, keep it up for the minimum
  // duration. Depending on searchParams makes same-page ?tab= switches clear it.
  useEffect(() => {
    if (!active) return;
    clearTimeout(safetyRef.current);
    const elapsed = Date.now() - startRef.current;
    hideRef.current = setTimeout(
      () => setActive(false),
      Math.max(0, MIN_VISIBLE_MS - elapsed),
    );
    return () => clearTimeout(hideRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

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
