"use client";

import { UpgradeButton } from "@/components/upgrade-button";
import { useSubscription } from "@/hooks/use-subscription";
import { subscriptionStatus } from "@/lib/subscription";

/** Pricing-card CTA for the Pro tier — "Renew Pro" for existing Pro users. */
export function ProCta({ defaultCta }: { defaultCta: string }) {
  const { plan, proUntil } = useSubscription();
  const { isPaid } = subscriptionStatus(plan, proUntil);
  return (
    <UpgradeButton plan="pro" size="lg" variant="gradient" className="mt-8 w-full">
      {isPaid ? "Renew Pro" : defaultCta}
    </UpgradeButton>
  );
}
