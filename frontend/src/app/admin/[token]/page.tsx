"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import {
  ShieldCheck,
  Users,
  Wrench,
  Server,
  ScrollText,
  Database,
  Triangle,
  LayoutDashboard,
  RefreshCw,
  LogOut,
  Loader2,
  Cpu,
  MemoryStick,
  HardDrive,
  Crown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { API_BASE } from "@/lib/api";
import { cn, formatBytes } from "@/lib/utils";
import {
  adminFetch,
  adminLogin,
  type AdminCreds,
  type AdminUser,
  type LogEntry,
  type OverviewResp,
  type ToolUse,
} from "@/lib/admin-api";

const SS_KEY = "aio-admin-pw";

function fmtNum(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString();
}
function fmtUptime(s?: number): string {
  if (!s) return "—";
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  return [d && `${d}d`, h && `${h}h`, `${m}m`].filter(Boolean).join(" ");
}
function fmtTime(ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString();
}
function fmtDate(s?: string | null): string {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" });
}

/* ── primitives ─────────────────────────────────────────────── */
function Stat({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium text-slate-500">{label}</p>
      <p className="mt-1 font-display text-2xl font-bold text-slate-900">{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-400">{sub}</p>}
    </div>
  );
}

function Gauge({ label, pct, detail, icon: Icon }: { label: string; pct: number | null | undefined; detail: string; icon: typeof Cpu }) {
  const p = Math.max(0, Math.min(100, pct ?? 0));
  const color = p > 85 ? "bg-red-500" : p > 60 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Icon className="h-4 w-4" /> {label}
        </span>
        <span className="text-sm font-bold text-slate-900">{pct == null ? "—" : `${p}%`}</span>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${p}%` }} />
      </div>
      <p className="mt-1.5 text-xs text-slate-400">{detail}</p>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      {children}
    </div>
  );
}

function Dot({ on }: { on: boolean }) {
  return <span className={cn("inline-block h-2 w-2 rounded-full", on ? "bg-emerald-500" : "bg-slate-300")} />;
}

/* ── sections ───────────────────────────────────────────────── */
function Overview({ data }: { data: OverviewResp }) {
  const s = data.stats;
  const sys = data.system;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total users" value={fmtNum(s.users)} sub={`${fmtNum(s.plans.pro)} Pro · ${fmtNum(s.plans.business)} Business`} />
        <Stat label="Conversions today" value={fmtNum(s.conversions_today)} sub={`${fmtNum(s.conversions)} all-time`} />
        <Stat label="Stored files" value={fmtNum(s.files)} sub="active + expired rows" />
        <Stat label="Storage in use" value={s.storage_used == null ? "—" : formatBytes(s.storage_used)} sub="non-expired files" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Gauge label="CPU" pct={sys.cpu_percent} detail={`${sys.cpu_count ?? "?"} vCPU`} icon={Cpu} />
        <Gauge
          label="Memory"
          pct={sys.memory_percent}
          detail={sys.memory_used && sys.memory_total ? `${formatBytes(sys.memory_used)} / ${formatBytes(sys.memory_total)}` : "—"}
          icon={MemoryStick}
        />
        <Gauge
          label="Disk"
          pct={sys.disk_percent}
          detail={sys.disk_used && sys.disk_total ? `${formatBytes(sys.disk_used)} / ${formatBytes(sys.disk_total)}` : "—"}
          icon={HardDrive}
        />
      </div>
      <Card title="Integrations">
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-600">
          {Object.entries(data.integrations).map(([k, v]) => (
            <span key={k} className="flex items-center gap-2">
              {typeof v === "boolean" ? <Dot on={v} /> : null} {k}
              {typeof v === "string" ? <span className="font-medium text-slate-900">: {v}</span> : null}
            </span>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  if (plan === "free") return <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">Free</span>;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-brand-gradient px-2 py-0.5 text-xs font-semibold text-white">
      <Crown className="h-3 w-3" /> {plan}
    </span>
  );
}

function UsersTable({ users }: { users: AdminUser[] }) {
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-4 py-3">User</th>
            <th className="px-4 py-3">Plan</th>
            <th className="px-4 py-3 text-right">Conversions</th>
            <th className="px-4 py-3">Last active</th>
            <th className="px-4 py-3">Joined</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((u) => (
            <tr key={u.id} className="hover:bg-slate-50">
              <td className="px-4 py-3">
                <p className="font-medium text-slate-900">{u.email}</p>
                {u.name && <p className="text-xs text-slate-400">{u.name}</p>}
              </td>
              <td className="px-4 py-3"><PlanBadge plan={u.plan} /></td>
              <td className="px-4 py-3 text-right font-medium">{fmtNum(u.conversions)}</td>
              <td className="px-4 py-3 text-slate-500">{fmtDate(u.last_active)}</td>
              <td className="px-4 py-3 text-slate-500">{fmtDate(u.created_at)}</td>
            </tr>
          ))}
          {users.length === 0 && (
            <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-400">No users yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

function ToolsList({ tools }: { tools: ToolUse[] }) {
  const max = Math.max(1, ...tools.map((t) => t.uses));
  return (
    <Card title={`Tool usage (${tools.length} tools)`}>
      <div className="space-y-2.5">
        {tools.map((t) => (
          <div key={t.tool} className="flex items-center gap-3">
            <span className="w-44 shrink-0 truncate text-sm text-slate-700">{t.tool}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
              <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${(t.uses / max) * 100}%` }} />
            </div>
            <span className="w-12 shrink-0 text-right text-sm font-semibold">{fmtNum(t.uses)}</span>
          </div>
        ))}
        {tools.length === 0 && <p className="py-6 text-center text-sm text-slate-400">No usage recorded yet.</p>}
      </div>
    </Card>
  );
}

function SystemSection({ data }: { data: OverviewResp }) {
  const sys = data.system;
  return (
    <div className="space-y-5">
      {!sys.available && (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Live stats need <code>psutil</code> (installed on the deployed backend) — showing limited info here.
        </p>
      )}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Gauge label="CPU" pct={sys.cpu_percent} detail={`${sys.cpu_count ?? "?"} vCPU · load ${sys.load_avg?.map((l) => l.toFixed(2)).join(" ") ?? "—"}`} icon={Cpu} />
        <Gauge label="Memory" pct={sys.memory_percent} detail={sys.memory_used && sys.memory_total ? `${formatBytes(sys.memory_used)} / ${formatBytes(sys.memory_total)}` : "—"} icon={MemoryStick} />
        <Gauge label="Disk" pct={sys.disk_percent} detail={sys.disk_used && sys.disk_total ? `${formatBytes(sys.disk_used)} / ${formatBytes(sys.disk_total)}` : "—"} icon={HardDrive} />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Uptime" value={fmtUptime(sys.uptime_seconds)} />
        <Stat label="Backend RAM" value={sys.process_memory ? formatBytes(sys.process_memory) : "—"} />
        <Stat label="Threads" value={fmtNum(sys.threads)} />
        <Stat label="Environment" value={String(data.integrations.environment ?? "—")} />
      </div>
      <Card title="Limits & configuration">
        <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm md:grid-cols-3">
          {Object.entries(data.limits).map(([k, v]) => (
            <div key={k} className="flex items-center justify-between border-b border-slate-100 py-1.5">
              <span className="text-slate-500">{k}</span>
              <span className="font-medium text-slate-900">{String(v)}</span>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

const LOG_SCOPES = [
  { key: "backend", label: "Backend" },
  { key: "frontend", label: "Frontend" },
  { key: "hf-run", label: "HF Container" },
  { key: "hf-build", label: "HF Build" },
] as const;
type LogScope = (typeof LOG_SCOPES)[number]["key"];

function LogsSection({ creds }: { creds: AdminCreds }) {
  const [scope, setScope] = React.useState<LogScope>("backend");
  const [logs, setLogs] = React.useState<LogEntry[]>([]);
  const [note, setNote] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const isHf = scope === "hf-run" || scope === "hf-build";

  const load = React.useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      if (scope === "hf-run" || scope === "hf-build") {
        const kind = scope === "hf-build" ? "build" : "run";
        const r = await adminFetch<{ configured: boolean; error?: string; logs: LogEntry[] }>(
          `/hf-logs?kind=${kind}`,
          creds,
        );
        if (!r.configured) setNote("Set HF_TOKEN, HF_USERNAME and HF_SPACE on the backend to view HF logs.");
        else if (r.error) setNote(r.error);
        setLogs(r.logs ?? []);
      } else {
        const r = await adminFetch<{ logs: LogEntry[] }>(`/logs?scope=${scope}&limit=400`, creds);
        setLogs(r.logs);
      }
    } catch (e) {
      setNote((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [scope, creds]);

  React.useEffect(() => {
    load();
    if (isHf) return; // HF logs are a slow streaming fetch — manual refresh only
    const id = window.setInterval(load, 8000);
    return () => window.clearInterval(id);
  }, [load, isHf]);

  const levelColor = (l: string) =>
    l === "ERROR" || l === "CRITICAL" ? "text-red-400" : l === "WARNING" ? "text-amber-400" : "text-slate-400";

  async function sendTest() {
    try {
      await fetch(`${API_BASE}/api/admin/client-error`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "Test log from admin panel", source: "admin-test", level: "info" }),
      });
      setScope("frontend");
      setTimeout(load, 400);
    } catch {
      /* ignore */
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm">
          {LOG_SCOPES.map((s) => (
            <button
              key={s.key}
              onClick={() => setScope(s.key)}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs sm:text-sm",
                scope === s.key ? "bg-slate-900 text-white" : "text-slate-600",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={busy}>
          <RefreshCw className={cn("h-4 w-4", busy && "animate-spin")} /> Refresh
        </Button>
        <Button variant="ghost" size="sm" onClick={sendTest}>
          Send test log
        </Button>
        <span className="text-xs text-slate-400">{isHf ? "manual · streamed from HF" : "auto-refresh 8s"}</span>
      </div>
      {note && <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">{note}</p>}
      <div className="h-[28rem] overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-3 font-mono text-xs leading-relaxed">
        {logs.length === 0 ? (
          <p className="p-4 text-center text-slate-500">
            {scope === "frontend"
              ? "No frontend errors captured — that's good. Uncaught JS errors appear here automatically; click “Send test log” to verify the pipeline."
              : isHf
                ? busy
                  ? "Fetching from Hugging Face…"
                  : "No HF logs returned."
                : "No backend logs yet."}
          </p>
        ) : (
          logs.map((l, i) => (
            <div key={i} className="flex gap-2 whitespace-pre-wrap break-all py-0.5">
              <span className="shrink-0 text-slate-600">{fmtTime(l.ts)}</span>
              <span className={cn("w-14 shrink-0 font-semibold", levelColor(l.level))}>{l.level}</span>
              <span className="shrink-0 text-cyan-500">{l.source}</span>
              <span className="text-slate-300">{l.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function SupabaseSection({ data }: { data: OverviewResp }) {
  const s = data.stats;
  const ss = data.supabase_system;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="profiles" value={fmtNum(s.users)} />
        <Stat label="conversions" value={fmtNum(s.conversions)} />
        <Stat label="files" value={fmtNum(s.files)} />
        <Stat label="active storage" value={s.storage_used == null ? "—" : formatBytes(s.storage_used)} />
      </div>

      {ss?.available ? (
        <div>
          <p className="mb-3 text-sm font-semibold text-slate-700">Database instance (live)</p>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Gauge label="CPU (load)" pct={ss.cpu_percent} detail={`load ${ss.load1 ?? "—"} · ${ss.cpus ?? "?"} vCPU`} icon={Cpu} />
            <Gauge
              label="Memory"
              pct={ss.memory_percent}
              detail={ss.memory_used && ss.memory_total ? `${formatBytes(ss.memory_used)} / ${formatBytes(ss.memory_total)}` : "—"}
              icon={MemoryStick}
            />
            <Gauge
              label="Disk"
              pct={ss.disk_percent}
              detail={ss.disk_used && ss.disk_total ? `${formatBytes(ss.disk_used)} / ${formatBytes(ss.disk_total)}` : "—"}
              icon={HardDrive}
            />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat label="Database size" value={ss.db_size ? formatBytes(ss.db_size) : "—"} />
          </div>
        </div>
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Live Supabase instance metrics unavailable (check the service-role key / project).
        </p>
      )}
      <Card title="Plan distribution">
        <div className="space-y-2.5">
          {Object.entries(s.plans).map(([plan, n]) => {
            const total = s.users || 1;
            const pct = Math.round(((n ?? 0) / total) * 100);
            return (
              <div key={plan} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-sm capitalize text-slate-700">{plan}</span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full bg-brand-gradient" style={{ width: `${pct}%` }} />
                </div>
                <span className="w-16 shrink-0 text-right text-sm font-semibold">{fmtNum(n)} ({pct}%)</span>
              </div>
            );
          })}
        </div>
      </Card>
      <p className="text-xs text-slate-400">
        Live database/platform metrics are in the Supabase dashboard. These counts are read with the service-role key.
      </p>
    </div>
  );
}

function VercelSection({ creds }: { creds: AdminCreds }) {
  const [count, setCount] = React.useState<number | null>(null);
  React.useEffect(() => {
    adminFetch<{ logs: LogEntry[] }>("/logs?scope=frontend&limit=400", creds)
      .then((r) => setCount(r.logs.length))
      .catch(() => setCount(null));
  }, [creds]);
  return (
    <div className="space-y-4">
      <Card title="Frontend (Vercel)">
        <p className="text-sm text-slate-600">
          Vercel hosts the frontend <strong>serverlessly</strong> — there is no fixed server, so there is no persistent
          CPU / RAM / disk to report (functions spin up per request and shut down). Bandwidth & invocation usage live in
          the Vercel dashboard; what this panel captures in real time are <strong>client-side JavaScript errors</strong>
          (see the “Logs → frontend” tab).
        </p>
        <div className="mt-4 flex items-center gap-4">
          <Stat label="Captured client errors" value={count == null ? "—" : fmtNum(count)} />
          <a
            href="https://vercel.com/dashboard"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Open Vercel dashboard ↗
          </a>
        </div>
      </Card>
      <p className="text-xs text-slate-400">Tip: see the captured errors under the “Logs → frontend” tab.</p>
    </div>
  );
}

/* ── shell ──────────────────────────────────────────────────── */
const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "users", label: "Users", icon: Users },
  { key: "tools", label: "Tools", icon: Wrench },
  { key: "system", label: "System", icon: Server },
  { key: "logs", label: "Logs", icon: ScrollText },
  { key: "supabase", label: "Supabase", icon: Database },
  { key: "vercel", label: "Vercel", icon: Triangle },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function Panel({ creds, onLogout }: { creds: AdminCreds; onLogout: () => void }) {
  const [tab, setTab] = React.useState<TabKey>("overview");
  const [overview, setOverview] = React.useState<OverviewResp | null>(null);
  const [users, setUsers] = React.useState<AdminUser[] | null>(null);
  const [tools, setTools] = React.useState<ToolUse[] | null>(null);
  const [err, setErr] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setErr(null);
    try {
      const [o, u, t] = await Promise.all([
        adminFetch<OverviewResp>("/overview", creds),
        adminFetch<{ users: AdminUser[] }>("/users", creds),
        adminFetch<{ tools: ToolUse[] }>("/tools", creds),
      ]);
      setOverview(o);
      setUsers(u.users);
      setTools(t.tools);
    } catch (e) {
      setErr((e as Error).message);
    }
  }, [creds]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-gradient text-white">
            <ShieldCheck className="h-4.5 w-4.5" />
          </span>
          <span className="font-display font-bold text-slate-900">Admin</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4" /> Refresh
          </Button>
          <Button variant="ghost" size="sm" onClick={onLogout}>
            <LogOut className="h-4 w-4" /> Sign out
          </Button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6">
        <nav className="mb-6 flex flex-wrap gap-1.5">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                tab === t.key ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-white",
              )}
            >
              <t.icon className="h-4 w-4" /> {t.label}
            </button>
          ))}
        </nav>

        {err && <p className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{err}</p>}

        {!overview ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {tab === "overview" && <Overview data={overview} />}
            {tab === "users" && <UsersTable users={users ?? []} />}
            {tab === "tools" && <ToolsList tools={tools ?? []} />}
            {tab === "system" && <SystemSection data={overview} />}
            {tab === "logs" && <LogsSection creds={creds} />}
            {tab === "supabase" && <SupabaseSection data={overview} />}
            {tab === "vercel" && <VercelSection creds={creds} />}
          </>
        )}
      </div>
    </div>
  );
}

function LoginGate({ token, onAuthed }: { token: string; onAuthed: (c: AdminCreds) => void }) {
  const [password, setPassword] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [err, setErr] = React.useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const creds = { token, password };
    try {
      await adminLogin(creds);
      sessionStorage.setItem(SS_KEY, password);
      onAuthed(creds);
    } catch (e2) {
      setErr((e2 as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen place-items-center bg-slate-100 p-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-2">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-brand-gradient text-white">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <p className="font-display font-bold text-slate-900">Admin access</p>
            <p className="text-xs text-slate-400">Enter the admin password</p>
          </div>
        </div>
        <input
          type="password"
          autoFocus
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-slate-900"
        />
        {err && <p className="mt-2 text-sm text-red-600">{err}</p>}
        <Button type="submit" variant="gradient" className="mt-4 w-full" disabled={busy || !password}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Unlock
        </Button>
      </form>
    </div>
  );
}

export default function AdminPage() {
  const params = useParams<{ token: string }>();
  const token = params?.token ?? "";
  const [creds, setCreds] = React.useState<AdminCreds | null>(null);
  const [checked, setChecked] = React.useState(false);

  // Restore a saved password (session-scoped) on reload.
  React.useEffect(() => {
    const pw = typeof window !== "undefined" ? sessionStorage.getItem(SS_KEY) : null;
    if (pw) {
      const c = { token, password: pw };
      adminLogin(c).then(() => setCreds(c)).catch(() => sessionStorage.removeItem(SS_KEY)).finally(() => setChecked(true));
    } else {
      setChecked(true);
    }
  }, [token]);

  function logout() {
    sessionStorage.removeItem(SS_KEY);
    setCreds(null);
  }

  if (!checked) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-100">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }
  if (!creds) return <LoginGate token={token} onAuthed={setCreds} />;
  return <Panel creds={creds} onLogout={logout} />;
}
