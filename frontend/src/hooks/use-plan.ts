"use client";

import { useCallback, useEffect, useState } from "react";
import type { SubscriptionPlan } from "@/lib/types";
import { planLimits, type PlanLimits } from "@/lib/plans";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { startOfTodayISO } from "@/lib/conversions";
import { useUser } from "./use-user";

export interface PlanUsage {
  plan: SubscriptionPlan;
  limits: PlanLimits;
  /** Conversions already run today (for the daily quota). */
  tasksToday: number;
  /** Bytes of retained (non-expired) output currently stored. */
  storageUsed: number;
  /** True once plan + usage have been resolved. */
  ready: boolean;
  loggedIn: boolean;
  /** Optimistically increment the local task count after a successful run. */
  bumpTasks: () => void;
}

/**
 * Resolves the signed-in user's plan and current usage for quota enforcement.
 * Anonymous (or unconfigured) callers fall back to Free limits with zero usage.
 */
export function usePlan(): PlanUsage {
  const { user, loading } = useUser();
  const [plan, setPlan] = useState<SubscriptionPlan>("free");
  const [tasksToday, setTasksToday] = useState(0);
  const [storageUsed, setStorageUsed] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user || !isSupabaseConfigured()) {
      setReady(true);
      return;
    }

    let cancelled = false;
    (async () => {
      const supabase = createClient();
      const [profileRes, tasksRes, filesRes] = await Promise.all([
        supabase.from("profiles").select("plan").eq("id", user.id).maybeSingle(),
        supabase
          .from("conversions")
          .select("id", { count: "exact", head: true })
          .gte("created_at", startOfTodayISO()),
        supabase.from("files").select("size, expires_at"),
      ]);
      if (cancelled) return;

      const p = (profileRes.data?.plan as SubscriptionPlan | undefined) ?? "free";
      setPlan(p);
      setTasksToday(tasksRes.count ?? 0);

      const now = Date.now();
      const used = (filesRes.data ?? [])
        .filter((f) => !f.expires_at || new Date(f.expires_at).getTime() > now)
        .reduce((sum, f) => sum + (f.size ?? 0), 0);
      setStorageUsed(used);
      setReady(true);
    })().catch(() => {
      if (!cancelled) setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, [user, loading]);

  const bumpTasks = useCallback(() => setTasksToday((t) => t + 1), []);

  return {
    plan,
    limits: planLimits(plan),
    tasksToday,
    storageUsed,
    ready,
    loggedIn: Boolean(user),
    bumpTasks,
  };
}
