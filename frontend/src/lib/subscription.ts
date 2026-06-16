/** Derived subscription status for a plan + its expiry (pro_until). */
export interface SubscriptionStatus {
  /** True for any paid plan (pro/business). */
  isPaid: boolean;
  /** Whole days remaining until the plan lapses (0 if past), or null if unknown. */
  daysLeft: number | null;
  /** Human date the plan renews/expires, or null. */
  expiryLabel: string | null;
}

export function subscriptionStatus(
  plan: string | null | undefined,
  proUntil?: string | null,
): SubscriptionStatus {
  const isPaid = Boolean(plan) && plan !== "free";
  if (!isPaid || !proUntil) return { isPaid, daysLeft: null, expiryLabel: null };

  const expiry = new Date(proUntil);
  if (Number.isNaN(expiry.getTime())) return { isPaid, daysLeft: null, expiryLabel: null };

  const daysLeft = Math.max(0, Math.ceil((expiry.getTime() - Date.now()) / 86_400_000));
  const expiryLabel = expiry.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return { isPaid, daysLeft, expiryLabel };
}
