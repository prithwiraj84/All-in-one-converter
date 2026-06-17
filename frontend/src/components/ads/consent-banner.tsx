"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useConsent, setConsent } from "@/lib/consent";
import { USE_GOOGLE_CMP } from "@/lib/ads";

/**
 * Lightweight cookie-consent banner. Non-essential cookies (ads/analytics) are
 * opt-in: ads only load after "Accept". Shown once until a choice is made.
 *
 * Note: for full EEA/UK AdSense compliance, also enable Google's certified CMP
 * (AdSense → Privacy & messaging / Funding Choices), which is geo-aware.
 */
export function ConsentBanner() {
  const consent = useConsent();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // When Google's CMP is active it handles consent — don't double-banner.
  if (USE_GOOGLE_CMP) return null;
  if (!mounted || consent !== null) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] p-3 sm:p-4">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 rounded-2xl border border-border bg-card/95 p-4 shadow-card-hover backdrop-blur sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <Cookie className="h-4 w-4" />
          </span>
          <p className="text-sm text-muted-foreground">
            We use essential cookies to run the site and, on the free plan, optional cookies to show ads and measure
            traffic. See our{" "}
            <Link href="/privacy" className="font-medium text-primary underline-offset-2 hover:underline">
              Privacy Policy
            </Link>
            .
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={() => setConsent("rejected")}>
            Reject non-essential
          </Button>
          <Button variant="gradient" size="sm" onClick={() => setConsent("accepted")}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  );
}
