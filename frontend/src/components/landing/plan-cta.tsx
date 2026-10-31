"use client";

import { UpgradeButton } from "@/components/upgrade-button";
import type { ButtonProps } from "@/components/ui/button";
import { useSubscription } from "@/hooks/use-subscription";
import { planLimits } from "@/lib/plans";
import type { SubscriptionPlan } from "@/lib/types";

/** Pricing-card CTA for a paid tier — opens checkout, or "Renew …" for someone
 *  who already pays for that plan. */
export function PlanCta({
  plan,
  defaultCta,
  variant = "gradient",
}: {
  plan: SubscriptionPlan;
  defaultCta: string;
  variant?: ButtonProps["variant"];
}) {
  const { plan: current, owner } = useSubscription();
  const renew = owner && current === plan;
  return (
    <UpgradeButton plan={plan} size="lg" variant={variant} className="mt-8 w-full">
      {renew ? `Renew ${planLimits(plan).label}` : defaultCta}
    </UpgradeButton>
  );
}
