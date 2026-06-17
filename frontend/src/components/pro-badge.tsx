"use client";

import { Crown } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/use-subscription";
import { subscriptionStatus } from "@/lib/subscription";

/**
 * Self-contained PRO badge — renders only for paid users (null otherwise), so it
 * can be dropped next to any avatar across the app. Brand-gradient pill with a
 * crown, a soft glow, and a sweeping "shine" streak for a premium feel.
 */
export function ProBadge({ className }: { className?: string }) {
  const { plan, proUntil } = useSubscription();
  if (!subscriptionStatus(plan, proUntil).isPaid) return null;

  return (
    <span
      className={cn(
        "relative inline-flex select-none items-center gap-1 overflow-hidden rounded-full bg-brand-gradient bg-[length:200%_200%] px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-white shadow-[0_2px_12px_-2px_rgba(124,58,237,0.65)] ring-1 ring-white/40 animate-gradient-shift",
        className,
      )}
    >
      {/* sweeping light streak */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 animate-shine bg-[linear-gradient(110deg,transparent_38%,rgba(255,255,255,0.6)_50%,transparent_62%)]"
      />
      <Crown className="relative h-3 w-3" strokeWidth={2.6} />
      <span className="relative">Pro</span>
    </span>
  );
}
