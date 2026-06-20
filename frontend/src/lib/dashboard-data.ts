import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { SubscriptionPlan } from "./types";
import { planLimits, type PlanLimits } from "./plans";
import { API_BASE } from "./api";

export interface DashFile {
  id: string;
  filename: string;
  size: number;
  type: string | null;
  status: string;
  storage_path: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface DashConversion {
  id: string;
  tool: string;
  source_file: string | null;
  output_file: string | null;
  status: string;
  error: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface DashUsage {
  storageUsed: number;
  storageQuota: number;
  tasksToday: number;
  dailyQuota: number;
  filesActive: number;
  conversionsTotal: number;
}

export interface DashboardData {
  loggedIn: boolean;
  email: string | null;
  name: string | null;
  plan: SubscriptionPlan;
  /** True only for a paying owner (false for a member who inherits Business). */
  isOwner: boolean;
  /** When a paid plan lapses back to Free (ISO), or null. */
  proUntil: string | null;
  limits: PlanLimits;
  files: DashFile[];
  conversions: DashConversion[];
  usage: DashUsage;
}

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/** A safe, zeroed dashboard payload (logged-out / env-missing fallback). */
export function emptyDashboardData(): DashboardData {
  return empty(false);
}

function empty(loggedIn: boolean): DashboardData {
  const limits = planLimits("free");
  return {
    loggedIn,
    email: null,
    name: null,
    plan: "free",
    isOwner: false,
    proUntil: null,
    limits,
    files: [],
    conversions: [],
    usage: {
      storageUsed: 0,
      storageQuota: limits.storageBytes,
      tasksToday: 0,
      dailyQuota: limits.dailyTasks,
      filesActive: 0,
      conversionsTotal: 0,
    },
  };
}

/**
 * Loads the signed-in user's plan, files, conversions and computed usage.
 * Relies on Supabase RLS (the server client carries the user's session), so
 * every row returned already belongs to this user.
 */
export async function getDashboardData(
  supabase: SupabaseClient,
  user: User | null,
): Promise<DashboardData> {
  if (!user) return empty(false);

  const [profileRes, filesRes, conversionsRes, tasksTodayRes] = await Promise.all([
    supabase.from("profiles").select("plan, email, name, pro_until").eq("id", user.id).maybeSingle(),
    supabase.from("files").select("*").order("created_at", { ascending: false }).limit(100),
    supabase.from("conversions").select("*").order("created_at", { ascending: false }).limit(100),
    supabase
      .from("conversions")
      .select("id", { count: "exact", head: true })
      .gte("created_at", startOfTodayISO()),
  ]);

  // Effective plan = own plan upgraded to Business if on a Business team. Read
  // it from the backend (authoritative); fall back to the profile's own plan.
  let plan = (profileRes.data?.plan as SubscriptionPlan | undefined) ?? "free";
  let isOwner = plan !== "free";
  try {
    const { data: sess } = await supabase.auth.getSession();
    const token = sess.session?.access_token;
    if (token) {
      const r = await fetch(`${API_BASE}/api/me/plan`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (r.ok) {
        const me = (await r.json()) as { plan?: string; owner?: boolean };
        plan = (me.plan as SubscriptionPlan) || plan;
        isOwner = Boolean(me.owner);
      }
    }
  } catch {
    /* backend unavailable → keep the profile plan */
  }
  const limits = planLimits(plan);
  const files = (filesRes.data ?? []) as DashFile[];
  const conversions = (conversionsRes.data ?? []) as DashConversion[];

  const now = Date.now();
  // Only surface files that are still downloadable — expired rows aren't useful
  // (the processed file is gone) and would otherwise pile up in "My Files".
  const activeFiles = files.filter(
    (f) => !f.expires_at || new Date(f.expires_at).getTime() > now,
  );
  const storageUsed = activeFiles.reduce((sum, f) => sum + (f.size ?? 0), 0);

  return {
    loggedIn: true,
    email: (profileRes.data?.email as string | undefined) ?? user.email ?? null,
    name:
      (profileRes.data?.name as string | undefined) ??
      (user.user_metadata?.full_name as string | undefined) ??
      null,
    plan,
    isOwner,
    proUntil: (profileRes.data?.pro_until as string | undefined) ?? null,
    limits,
    files: activeFiles,
    conversions,
    usage: {
      storageUsed,
      storageQuota: limits.storageBytes,
      tasksToday: tasksTodayRes.count ?? 0,
      dailyQuota: limits.dailyTasks,
      filesActive: activeFiles.length,
      conversionsTotal: conversions.length,
    },
  };
}
