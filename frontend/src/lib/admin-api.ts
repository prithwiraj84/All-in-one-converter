import { API_BASE } from "./api";

export interface AdminCreds {
  token: string;
  password: string;
}

export interface SystemStats {
  available: boolean;
  cpu_percent?: number;
  cpu_count?: number;
  load_avg?: number[] | null;
  memory_used?: number | null;
  memory_total?: number | null;
  memory_percent?: number | null;
  disk_used?: number | null;
  disk_total?: number | null;
  disk_percent?: number | null;
  process_memory?: number;
  uptime_seconds?: number;
  threads?: number;
}

export interface SupaSystem {
  available: boolean;
  cpus?: number;
  load1?: number | null;
  cpu_percent?: number | null;
  memory_used?: number | null;
  memory_total?: number | null;
  memory_percent?: number | null;
  disk_used?: number | null;
  disk_total?: number | null;
  disk_percent?: number | null;
  db_size?: number | null;
}

export interface OverviewResp {
  stats: {
    users: number | null;
    plans: Record<string, number | null>;
    conversions: number | null;
    conversions_today: number | null;
    files: number | null;
    storage_used: number | null;
  };
  system: SystemStats;
  supabase_system: SupaSystem | null;
  integrations: Record<string, boolean | string>;
  limits: Record<string, number | string>;
}

export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  plan: string;
  pro_until: string | null;
  created_at: string;
  conversions: number;
  last_active: string | null;
}

export interface ToolUse {
  tool: string;
  uses: number;
}

export interface LogEntry {
  ts: number;
  level: string;
  source: string;
  message: string;
}

export async function adminFetch<T>(
  path: string,
  creds: AdminCreds,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}/api/admin${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init?.headers || {}),
      "X-Admin-Token": creds.token,
      "X-Admin-Password": creds.password,
    },
  });
  if (res.status === 401) throw new Error("Invalid password.");
  if (res.status === 404) throw new Error("Admin panel isn't enabled, or the URL token is wrong.");
  if (!res.ok) throw new Error(`Request failed (${res.status}).`);
  return res.json() as Promise<T>;
}

export async function adminLogin(creds: AdminCreds): Promise<void> {
  await adminFetch("/login", creds, { method: "POST" });
}
