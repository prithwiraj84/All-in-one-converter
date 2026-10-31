"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X, ChevronDown, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { NAV_LINKS } from "@/lib/site-config";
import { CATEGORIES, toolsByCategory } from "@/lib/tools-registry";
import { useUser } from "@/hooks/use-user";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/shared/logo";
import { ToolSearch } from "@/components/tools/tool-search";
import { UserMenu } from "./user-menu";

const NAV_CATEGORIES = CATEGORIES.filter((c) => toolsByCategory(c.key).length > 0);

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const { user, loading } = useUser();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-300",
        scrolled ? "border-b border-border/70 bg-white/80 backdrop-blur-xl shadow-sm" : "bg-transparent",
      )}
    >
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 sm:px-6 lg:px-8">
        <div className="flex items-center gap-8">
          <Logo />
          <div className="hidden items-center gap-1 lg:flex">
            {/* Tools mega-menu */}
            <div
              className="relative"
              onMouseEnter={() => setToolsOpen(true)}
              onMouseLeave={() => setToolsOpen(false)}
              onKeyDown={(e) => e.key === "Escape" && setToolsOpen(false)}
            >
              {/* Click toggles too, so touch laptops / tablets can open it. */}
              <button
                type="button"
                onClick={() => setToolsOpen((v) => !v)}
                aria-expanded={toolsOpen}
                aria-haspopup="true"
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                Tools <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", toolsOpen && "rotate-180")} />
              </button>
              <AnimatePresence>
                {toolsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.18 }}
                    className="absolute left-0 top-full w-[640px] pt-3"
                  >
                    <div className="grid grid-cols-3 gap-1 rounded-2xl border border-border bg-popover p-3 shadow-card-hover">
                      {NAV_CATEGORIES.map((cat) => {
                        const CatIcon = cat.icon;
                        return (
                          <Link
                            key={cat.key}
                            href={`/tools#${cat.key}`}
                            onClick={() => setToolsOpen(false)}
                            className="flex items-start gap-3 rounded-xl p-3 transition-colors hover:bg-muted"
                          >
                            <span
                              className={cn(
                                "grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white",
                                cat.gradient,
                              )}
                            >
                              <CatIcon className="h-4 w-4" />
                            </span>
                            <span>
                              <span className="block text-sm font-medium">{cat.label}</span>
                              <span className="block text-xs text-muted-foreground">
                                {toolsByCategory(cat.key).length} tools
                              </span>
                            </span>
                          </Link>
                        );
                      })}
                      <Link
                        href="/tools"
                        onClick={() => setToolsOpen(false)}
                        className="col-span-3 mt-1 flex items-center justify-center gap-1.5 rounded-xl bg-primary/5 py-2.5 text-sm font-medium text-primary hover:bg-primary/10"
                      >
                        View all tools <ArrowRight className="h-3.5 w-3.5" />
                      </Link>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {NAV_LINKS.filter((l) => l.label !== "Tools").map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </div>

        <div className="hidden items-center gap-2 lg:flex">
          {!loading && user ? (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/dashboard">Dashboard</Link>
              </Button>
              <UserMenu user={user} />
            </>
          ) : (
            <>
              <Button asChild variant="ghost" size="sm">
                <Link href="/login">Sign in</Link>
              </Button>
              <Button asChild variant="gradient" size="sm">
                <Link href="/signup">Start Free</Link>
              </Button>
            </>
          )}
        </div>

        <button
          type="button"
          className="grid h-11 w-11 place-items-center rounded-lg text-foreground lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-border bg-white lg:hidden"
          >
            <div className="max-h-[calc(100dvh-4rem)] overflow-y-auto overscroll-contain px-5 py-4">
              <p className="mb-2 text-sm font-semibold">What do you want to do?</p>
              <ToolSearch placeholder="e.g. compress PDF" onNavigate={() => setMobileOpen(false)} />

              <p className="mb-2 mt-5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Browse tools
              </p>
              <div className="grid grid-cols-2 gap-2">
                {NAV_CATEGORIES.map((cat) => {
                  const CatIcon = cat.icon;
                  return (
                    <Link
                      key={cat.key}
                      href={`/tools#${cat.key}`}
                      onClick={() => setMobileOpen(false)}
                      className="flex min-h-12 items-center gap-2.5 rounded-xl border border-border px-3 py-2 text-sm font-medium hover:bg-muted"
                    >
                      <span className={cn("grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-gradient-to-br text-white", cat.gradient)}>
                        <CatIcon className="h-3.5 w-3.5" />
                      </span>
                      <span className="leading-tight">{cat.short}</span>
                    </Link>
                  );
                })}
              </div>
              <Link
                href="/tools"
                onClick={() => setMobileOpen(false)}
                className="mt-2 flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-primary/5 text-sm font-semibold text-primary"
              >
                See all tools <ArrowRight className="h-4 w-4" />
              </Link>

              <div className="mt-4 border-t border-border pt-3">
                {NAV_LINKS.filter((l) => l.label !== "Tools").map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setMobileOpen(false)}
                    className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium hover:bg-muted"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
              <div className="flex flex-col gap-2 pt-3">
                {!loading && user ? (
                  <Button asChild variant="gradient">
                    <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
                      Go to Dashboard
                    </Link>
                  </Button>
                ) : (
                  <>
                    <Button asChild variant="outline">
                      <Link href="/login" onClick={() => setMobileOpen(false)}>
                        Sign in
                      </Link>
                    </Button>
                    <Button asChild variant="gradient">
                      <Link href="/signup" onClick={() => setMobileOpen(false)}>
                        Start Free
                      </Link>
                    </Button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
