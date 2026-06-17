"use client";

import { useEffect, useState } from "react";

export type Consent = "accepted" | "rejected";

const KEY = "aio-cookie-consent";
const EVENT = "aio-consent-change";

export function getConsent(): Consent | null {
  if (typeof window === "undefined") return null;
  const v = window.localStorage.getItem(KEY);
  return v === "accepted" || v === "rejected" ? v : null;
}

export function setConsent(v: Consent): void {
  window.localStorage.setItem(KEY, v);
  window.dispatchEvent(new Event(EVENT));
}

/** Reactive consent state — updates when the banner sets a choice. */
export function useConsent(): Consent | null {
  const [consent, setState] = useState<Consent | null>(null);

  useEffect(() => {
    const update = () => setState(getConsent());
    update();
    window.addEventListener(EVENT, update);
    window.addEventListener("storage", update);
    return () => {
      window.removeEventListener(EVENT, update);
      window.removeEventListener("storage", update);
    };
  }, []);

  return consent;
}
