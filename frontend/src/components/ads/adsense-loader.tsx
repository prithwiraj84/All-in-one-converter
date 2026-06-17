"use client";

import Script from "next/script";
import { useConsent } from "@/lib/consent";
import { ADSENSE_CLIENT, USE_GOOGLE_CMP } from "@/lib/ads";

/**
 * Loads the AdSense script. With Google's CMP the script loads whenever AdSense
 * is configured (the CMP + consent-mode hold ad requests until consent). With
 * the built-in banner, it loads only after the user accepts cookies.
 */
export function AdsenseLoader() {
  const consent = useConsent();
  if (!ADSENSE_CLIENT) return null;
  if (!USE_GOOGLE_CMP && consent !== "accepted") return null;
  return (
    <Script
      id="adsbygoogle-js"
      async
      strategy="afterInteractive"
      crossOrigin="anonymous"
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`}
    />
  );
}
