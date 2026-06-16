"use client";

import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { useUser } from "./use-user";

/**
 * Lightweight client hook for the signed-in user's plan + expiry — a single
 * profiles query (unlike usePlan, which also loads usage). Used by the upgrade
 * surfaces to decide between "Upgrade" and "Renew".
 */
export function useSubscription() {
  const { user, loading } = useUser();
  const [plan, setPlan] = useState<string>("free");
  const [proUntil, setProUntil] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !isSupabaseConfigured()) {
      setReady(true);
      return;
    }
    let cancelled = false;
    createClient()
      .from("profiles")
      .select("plan, pro_until")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setPlan((data?.plan as string | undefined) ?? "free");
        setProUntil((data?.pro_until as string | undefined) ?? null);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return { plan, proUntil, ready, loggedIn: Boolean(user) };
}
