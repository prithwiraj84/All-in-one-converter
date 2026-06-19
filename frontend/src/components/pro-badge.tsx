"use client";

import { Crown, Gem } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSubscription } from "@/hooks/use-subscription";
import { subscriptionStatus } from "@/lib/subscription";
import { planLimits } from "@/lib/plans";
import type { SubscriptionPlan } from "@/lib/types";

/**
 * Self-contained plan badge — renders only for paid users (null otherwise), so
 * it can be dropped next to any avatar across the app. Shows the actual plan
 * name ("Pro" / "Business"). Brand-gradient pill with a crown, a soft glow, and
 * a sweeping "shine" streak for a premium feel.
 */
export function ProBadge({ className }: { className?: string }) {
  const { plan, proUntil } = useSubscription();
  if (!subscriptionStatus(plan, proUntil).isPaid) return null;
  const isBusiness = plan === "business";
  const label = planLimits(plan as SubscriptionPlan).label;

  return (
    <span
      className={cn(
        "relative inline-flex select-none items-center gap-1 overflow-hidden rounded-full bg-[length:200%_200%] px-2.5 py-1 text-[10px] font-bold uppercase leading-none tracking-[0.12em] text-white ring-1",
        isBusiness
          ? // Business — deep red→maroon with a pulsing "ember" glow.
            "bg-[linear-gradient(110deg,#f43f5e_0%,#dc2626_30%,#9b1c1c_60%,#800000_100%)] ring-red-300/50 animate-business-pulse"
          : // Pro — brand purple/pink gradient.
            "bg-brand-gradient shadow-[0_2px_12px_-2px_rgba(124,58,237,0.65)] ring-white/40 animate-gradient-shift",
        className,
      )}
    >
      {/* sweeping light streak */}
      <span
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-0 animate-shine",
          isBusiness
            ? "bg-[linear-gradient(110deg,transparent_36%,rgba(255,225,180,0.7)_50%,transparent_64%)]"
            : "bg-[linear-gradient(110deg,transparent_38%,rgba(255,255,255,0.6)_50%,transparent_62%)]",
        )}
      />
      {isBusiness ? (
        <Gem className="relative h-3 w-3" strokeWidth={2.6} />
      ) : (
        <Crown className="relative h-3 w-3" strokeWidth={2.6} />
      )}
      <span className="relative">{label}</span>
    </span>
  );
}
