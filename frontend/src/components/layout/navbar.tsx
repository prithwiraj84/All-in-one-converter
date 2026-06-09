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
import { UserMenu } from "./user-menu";

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
            >
              <button className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground">
                Tools <ChevronDown className="h-3.5 w-3.5" />
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
                      {CATEGORIES.slice(0, 6).map((cat) => {
                        const CatIcon = cat.icon;
                        const first = toolsByCategory(cat.key)[0];
                        return (
                          <Link
                            key={cat.key}
                            href={first ? `/${first.slug}` : "/tools"}
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
          className="grid h-10 w-10 place-items-center rounded-lg text-foreground lg:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
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
            <div className="space-y-1 px-5 py-4">
              <Link
                href="/tools"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
              >
                All Tools
              </Link>
              {NAV_LINKS.filter((l) => l.label !== "Tools").map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium hover:bg-muted"
                >
                  {link.label}
                </Link>
              ))}
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
