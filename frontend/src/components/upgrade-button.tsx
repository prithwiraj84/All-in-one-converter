"use client";

import { Mail } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";

interface UpgradeButtonProps extends Omit<ButtonProps, "onClick" | "asChild"> {
  /** Plan the CTA refers to (used in the contact email subject). */
  plan?: string;
}

// Online payments are paused for now, so every upgrade/renew CTA opens an email
// to us instead of Razorpay checkout. The caller's label (e.g. "Upgrade now",
// "Renew Pro") is intentionally overridden to "Contact us".
// To restore checkout: bring back useUpgrade() — onClick={() => upgrade(plan)},
// the loading spinner, and render {children} again.
const CONTACT_EMAIL = "info@toshiconsulting.com";

export function UpgradeButton({ plan = "pro", ...props }: UpgradeButtonProps) {
  const subject = encodeURIComponent(
    `Upgrade to ${plan === "business" ? "Business" : "Pro"} — All in one converter`,
  );
  return (
    <Button
      type="button"
      onClick={() => {
        window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}`;
      }}
      {...props}
    >
      <Mail className="h-4 w-4" /> Contact us
    </Button>
  );
}
