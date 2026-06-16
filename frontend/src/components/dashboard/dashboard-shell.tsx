"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  LayoutDashboard,
  Files,
  RefreshCw,
  Wand2,
  Settings,
  Sparkles,
  Plus,
  Menu,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/shared/logo";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SignOutButton } from "./sign-out-button";
import { UpgradeButton } from "@/components/upgrade-button";
import { cn } from "@/lib/utils";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "My Files", href: "/dashboard?tab=files", icon: Files },
  { label: "Conversions", href: "/dashboard?tab=conversions", icon: RefreshCw },
  { label: "All Tools", href: "/tools", icon: Wand2 },
  { label: "Settings", href: "/dashboard?tab=settings", icon: Settings },
];

interface DashboardUser {
  email?: string;
  name?: string;
  avatar?: string;
}

interface DashboardShellProps {
  children: React.ReactNode;
  user: DashboardUser;
}

/** Derive 1–2 letter initials from a name or, failing that, an email. */
function getInitials(user: DashboardUser): string {
  const source = (user.name || user.email || "").trim();
  if (!source) return "U";
  if (user.name) {
    const parts = user.name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0].slice(0, 2).toUpperCase();
  }
  // Email: use the part before the @ sign.
  return source.split("@")[0].slice(0, 2).toUpperCase();
}

/** Match an active nav item against the current pathname + ?tab= param. */
function useIsActive() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");
  return React.useCallback(
    (href: string) => {
      const [path, query] = href.split("?");
      if (path !== pathname) return false;
      const tab = query ? new URLSearchParams(query).get("tab") : null;
      // Links without a tab target the bare page (e.g. /dashboard, /tools).
      if (!tab) {
        // Highlight the plain Dashboard link only when no tab is selected.
        if (pathname === "/dashboard") return !currentTab;
        return true;
      }
      return tab === currentTab;
    },
    [pathname, currentTab],
  );
}

function NavList({
  isActive,
  onNavigate,
}: {
  isActive: (href: string) => boolean;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex flex-col gap-1">
      {NAV_ITEMS.map((item) => {
        const active = isActive(item.href);
        return (
          <Link
            key={item.label}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <item.icon
              className={cn(
                "h-[18px] w-[18px] shrink-0 transition-colors",
                active ? "text-primary" : "text-muted-foreground group-hover:text-foreground",
              )}
            />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

function UpgradeCard() {
  return (
    <div className="gradient-border shadow-card">
      <div className="rounded-[calc(var(--radius)-2px)] bg-gradient-to-br from-primary/5 via-secondary/5 to-accent/5 p-4">
        <div className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-brand-gradient bg-[length:200%_200%] px-2.5 py-1 text-[11px] font-semibold text-white shadow-glow">
          <Sparkles className="h-3 w-3" />
          Pro
        </div>
        <p className="text-sm font-semibold leading-snug text-foreground">
          Upgrade to Pro
        </p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Unlock 2 GB files, unlimited tasks and priority processing.
        </p>
        <UpgradeButton variant="gradient" size="sm" className="mt-3 w-full">
          Upgrade now
        </UpgradeButton>
      </div>
    </div>
  );
}

function SidebarContent({
  isActive,
  onNavigate,
}: {
  isActive: (href: string) => boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="px-2 py-1">
        <Logo />
      </div>
      <div className="mt-7 flex-1 overflow-y-auto">
        <NavList isActive={isActive} onNavigate={onNavigate} />
      </div>
      <div className="mt-4 space-y-3">
        <UpgradeCard />
        <SignOutButton variant="outline" className="w-full" />
      </div>
    </>
  );
}

export function DashboardShell({ children, user }: DashboardShellProps) {
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const isActive = useIsActive();
  const initials = getInitials(user);

  const userAvatar = (
    <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm">
      {user.avatar ? <AvatarImage src={user.avatar} alt={user.name || user.email || "User"} /> : null}
      <AvatarFallback>{initials}</AvatarFallback>
    </Avatar>
  );

  const newConversionButton = (
    <Button asChild variant="gradient" size="sm" className="shadow-glow">
      <Link href="/tools">
        <Plus className="h-4 w-4" />
        New conversion
      </Link>
    </Button>
  );

  return (
    <div className="min-h-screen bg-surface">
      {/* Fixed left sidebar — desktop only */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-white/80 px-4 py-5 backdrop-blur lg:flex">
        <SidebarContent isActive={isActive} />
      </aside>

      {/* Mobile slide-in sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="lg:hidden">
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-40 bg-foreground/40 backdrop-blur-sm"
            />
            <motion.aside
              key="drawer"
              initial={{ x: "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: "-100%" }}
              transition={{ type: "spring", stiffness: 320, damping: 34 }}
              className="fixed inset-y-0 left-0 z-50 flex w-72 max-w-[82%] flex-col border-r border-border bg-white px-4 py-5 shadow-card-hover"
            >
              <div className="mb-1 flex items-center justify-between px-2">
                <Logo />
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setMobileOpen(false)}
                  aria-label="Close menu"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
              <div className="mt-6 flex-1 overflow-y-auto">
                <NavList isActive={isActive} onNavigate={() => setMobileOpen(false)} />
              </div>
              <div className="mt-4 space-y-3">
                <UpgradeCard />
                <SignOutButton variant="outline" className="w-full" />
              </div>
            </motion.aside>
          </div>
        )}
      </AnimatePresence>

      {/* Main column */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        {/* Mobile top bar */}
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-white/80 px-4 py-3 backdrop-blur lg:hidden">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </Button>
            <Logo showText={false} />
          </div>
          <div className="flex items-center gap-2">
            {newConversionButton}
            {userAvatar}
          </div>
        </header>

        {/* Desktop topbar */}
        <header className="sticky top-0 z-20 hidden items-center justify-between border-b border-border bg-white/80 px-6 py-3.5 backdrop-blur lg:flex lg:px-8">
          <div className="flex flex-col">
            <span className="text-xs font-medium text-muted-foreground">Workspace</span>
            <h1 className="font-display text-lg font-semibold tracking-tight text-foreground">
              Dashboard
            </h1>
          </div>
          <div className="flex items-center gap-4">
            {newConversionButton}
            {userAvatar}
          </div>
        </header>

        {/* Content */}
        <main className="flex-1">
          <div className="mx-auto max-w-6xl p-6 lg:p-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
