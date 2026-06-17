"use client";

import { useEffect, useRef, useState } from "react";
import { useSubscription } from "@/hooks/use-subscription";
import { subscriptionStatus } from "@/lib/subscription";
import { useConsent } from "@/lib/consent";
import { ADSENSE_CLIENT, ADSENSE_SLOT, USE_GOOGLE_CMP } from "@/lib/ads";
import { cn } from "@/lib/utils";

interface AdUnitProps {
  /** AdSense ad-unit id. Falls back to NEXT_PUBLIC_ADSENSE_SLOT. */
  slot?: string;
  format?: string;
  className?: string;
  /** Reserved height (px) to avoid layout shift before the ad loads. */
  minHeight?: number;
}

/**
 * A single AdSense slot. Renders ONLY for free/anonymous users who have
 * consented, and only when AdSense is configured. Paid users and un-consented
 * visitors get nothing (no wasted space). Reserve `minHeight` to protect CLS.
 */
export function AdUnit({ slot, format = "auto", className, minHeight = 120 }: AdUnitProps) {
  const adSlot = slot || ADSENSE_SLOT;
  const { plan, proUntil } = useSubscription();
  const isPaid = subscriptionStatus(plan, proUntil).isPaid;
  const consent = useConsent();
  const insRef = useRef<HTMLModElement>(null);
  const pushed = useRef(false);
  const [unfilled, setUnfilled] = useState(false);

  // With Google's CMP, ad-serving itself respects consent — so we just render.
  // Otherwise gate on our own banner's "accepted".
  const consentOk = USE_GOOGLE_CMP || consent === "accepted";
  const show = Boolean(ADSENSE_CLIENT && adSlot) && !isPaid && consentOk;

  useEffect(() => {
    if (!show || pushed.current) return;
    try {
      ((window as unknown as { adsbygoogle?: unknown[] }).adsbygoogle ||= []).push({});
      pushed.current = true;
    } catch {
      return; // AdSense not ready — it'll process the queued push on load
    }
    // Collapse the unit (hide the "Advertisement" label + space) if Google
    // returns no ad, so we never show an empty labelled box.
    const el = insRef.current;
    if (!el) return;
    const check = () => {
      if (el.getAttribute("data-ad-status") === "unfilled") setUnfilled(true);
    };
    check();
    const obs = new MutationObserver(check);
    obs.observe(el, { attributes: true, attributeFilter: ["data-ad-status"] });
    return () => obs.disconnect();
  }, [show]);

  if (!show || unfilled) return null;

  return (
    <div className={cn("my-6 w-full text-center", className)}>
      <p className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground/60">Advertisement</p>
      <ins
        ref={insRef}
        className="adsbygoogle block"
        style={{ display: "block", minHeight }}
        data-ad-client={ADSENSE_CLIENT}
        data-ad-slot={adSlot}
        data-ad-format={format}
        data-full-width-responsive="true"
      />
    </div>
  );
}
