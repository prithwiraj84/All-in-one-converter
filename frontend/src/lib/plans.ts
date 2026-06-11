import type { SubscriptionPlan } from "./types";

const MB = 1024 * 1024;
const GB = 1024 * MB;

/** Minutes a processed file is retained before auto-deletion (mirrors backend). */
export const RETENTION_MINUTES = 60;

export interface PlanLimits {
  label: string;
  /** Total retained storage allowed. */
  storageBytes: number;
  /** Largest single file that may be processed. */
  maxFileBytes: number;
  /** Conversions allowed per calendar day. `Infinity` = unlimited. */
  dailyTasks: number;
  /** Short price label for UI. */
  priceLabel: string;
}

/**
 * Plan limits — single source of truth for the whole app (quota enforcement,
 * dropzone caps, dashboard meters, pricing copy).
 */
export const PLAN_LIMITS: Record<SubscriptionPlan, PlanLimits> = {
  free: {
    label: "Free",
    storageBytes: 100 * MB,
    maxFileBytes: 10 * MB,
    dailyTasks: 5,
    priceLabel: "Free",
  },
  pro: {
    label: "Pro",
    storageBytes: 2 * GB,
    maxFileBytes: 1 * GB,
    dailyTasks: Infinity,
    priceLabel: "$9/mo",
  },
  business: {
    label: "Business",
    storageBytes: 20 * GB,
    maxFileBytes: 5 * GB,
    dailyTasks: Infinity,
    priceLabel: "Custom",
  },
};

/** Resolve limits for a plan, defaulting to Free for unknown/missing plans. */
export function planLimits(plan?: SubscriptionPlan | null): PlanLimits {
  return (plan && PLAN_LIMITS[plan]) || PLAN_LIMITS.free;
}

/** Render a task quota, showing "Unlimited" for the infinite tier. */
export function formatTaskQuota(n: number): string {
  return Number.isFinite(n) ? String(n) : "Unlimited";
}
