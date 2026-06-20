"use client";

import { useEffect, useState } from "react";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { getMyPlan } from "@/lib/business-api";
import { useUser } from "./use-user";

/**
 * The signed-in user's EFFECTIVE plan + expiry. Reads the backend
 * `/api/me/plan` (not `profiles.plan` directly) so a Free user who belongs to a
 * Business team correctly resolves to Business everywhere. `owner` is true only
 * for a paying owner (so member surfaces can hide billing/renew).
 */
export function useSubscription() {
  const { user, loading } = useUser();
  const [plan, setPlan] = useState<string>("free");
  const [proUntil, setProUntil] = useState<string | null>(null);
  const [owner, setOwner] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !isSupabaseConfigured()) {
      setReady(true);
      return;
    }
    let cancelled = false;
    getMyPlan()
      .then((d) => {
        if (cancelled) return;
        setPlan(d.plan || "free");
        setProUntil(d.pro_until);
        setOwner(Boolean(d.owner));
        setReady(true);
      })
      .catch(async () => {
        // Backend unavailable → fall back to the user's own profile plan.
        try {
          const { data } = await createClient()
            .from("profiles")
            .select("plan, pro_until")
            .eq("id", user.id)
            .maybeSingle();
          if (cancelled) return;
          setPlan((data?.plan as string | undefined) ?? "free");
          setProUntil((data?.pro_until as string | undefined) ?? null);
          setOwner(((data?.plan as string | undefined) ?? "free") !== "free");
        } finally {
          if (!cancelled) setReady(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  return { plan, proUntil, owner, ready, loggedIn: Boolean(user) };
}
