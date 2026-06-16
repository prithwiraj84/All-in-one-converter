import Link from "next/link";
import {
  ArrowRight,
  Files,
  HardDrive,
  Zap,
  Download,
  FileText,
  FileImage,
  FileType2,
  AudioLines,
  Film,
  FolderArchive,
  Type,
  File as FileIcon,
  Crown,
  Mail,
  User as UserIcon,
  Clock,
  Sparkles,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import { WavingHand } from "./waving-hand";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { ToolCard } from "@/components/tools/tool-card";
import { SignOutButton } from "./sign-out-button";
import { FEATURED_TOOLS, getTool } from "@/lib/tools-registry";
import { formatBytes, timeAgo, cn } from "@/lib/utils";
import { downloadUrl } from "@/lib/api";
import { formatTaskQuota, RETENTION_MINUTES } from "@/lib/plans";
import type { DashboardData, DashFile, DashConversion, DashUsage } from "@/lib/dashboard-data";
import type { ReactNode } from "react";
import { RefreshButton, DeleteFileButton } from "./dashboard-actions";

/* ── Shared primitives ──────────────────────────────────────────── */

function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}>
      <div
        className="h-full rounded-full bg-brand-gradient bg-[length:200%_200%] animate-gradient-shift transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  caption,
  progress,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  caption?: string;
  progress?: number;
}) {
  return (
    <Card className="group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover">
      <span className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand-gradient opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20" />
      <span className="grid h-11 w-11 place-items-center rounded-lg bg-brand-gradient bg-[length:200%_200%] text-white shadow-glow">
        <Icon className="h-5 w-5" strokeWidth={2.2} />
      </span>
      <div className="mt-4 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="font-display text-3xl font-bold tracking-tight">{value}</p>
      </div>
      {typeof progress === "number" && <ProgressBar value={progress} className="mt-4" />}
      {caption && <p className="mt-2 text-xs text-muted-foreground">{caption}</p>}
    </Card>
  );
}

const CONV_STATUS: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
  completed: { variant: "success", label: "Completed" },
  processing: { variant: "accent", label: "Processing" },
  queued: { variant: "muted", label: "Queued" },
  failed: { variant: "outline", label: "Failed" },
};

function ConvStatusBadge({ status }: { status: string }) {
  const cfg = CONV_STATUS[status] ?? CONV_STATUS.completed;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function fileIconFor(type: string | null, filename: string): LucideIcon {
  const t = (type ?? "").toLowerCase();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  if (t.startsWith("image") || ["png", "jpg", "jpeg", "webp", "gif", "bmp", "tiff"].includes(ext))
    return FileImage;
  if (t.startsWith("audio") || ["mp3", "wav", "ogg", "flac", "m4a"].includes(ext)) return AudioLines;
  if (t.startsWith("video") || ["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return Film;
  if (t.includes("zip") || ["zip", "tar", "gz"].includes(ext)) return FolderArchive;
  if (["ttf", "otf", "woff", "woff2"].includes(ext)) return Type;
  if (t.includes("pdf") || ext === "pdf") return FileText;
  if (["doc", "docx", "xls", "xlsx", "ppt", "pptx", "txt", "rtf", "odt"].includes(ext))
    return FileType2;
  return FileIcon;
}

function isExpired(file: DashFile): boolean {
  return Boolean(file.expires_at && new Date(file.expires_at).getTime() <= Date.now());
}

function EmptyState({
  icon: Icon,
  title,
  hint,
}: {
  icon: LucideIcon;
  title: string;
  hint: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-surface/50 px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-6 w-6" />
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{hint}</p>
      </div>
      <Button asChild variant="gradient" size="sm">
        <Link href="/tools">
          Start a conversion <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}

function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1.5 text-muted-foreground">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

/* ── Row renderers ──────────────────────────────────────────────── */

function ConversionRow({ row }: { row: DashConversion }) {
  const tool = getTool(row.tool);
  const Icon = tool?.icon ?? RefreshCw;
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{tool?.title ?? row.tool}</p>
        <p className="truncate text-xs text-muted-foreground">
          {row.output_file ?? row.source_file ?? "—"}
        </p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <ConvStatusBadge status={row.status} />
        <span className="text-xs text-muted-foreground">{timeAgo(row.created_at)}</span>
      </div>
    </li>
  );
}

function FileRow({ file }: { file: DashFile }) {
  const Icon = fileIconFor(file.type, file.filename);
  const expired = isExpired(file);
  const href = file.storage_path ? downloadUrl(file.storage_path) : null;
  return (
    <li className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary/10 text-secondary">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold">{file.filename}</p>
        <p className="truncate text-xs text-muted-foreground">
          {formatBytes(file.size)} · {timeAgo(file.created_at)}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {expired || !href ? (
          <Badge variant="muted">Expired</Badge>
        ) : (
          <Button asChild variant="outline" size="sm">
            <a href={href} download={file.filename} rel="noopener">
              <Download className="h-3.5 w-3.5" /> Download
            </a>
          </Button>
        )}
        <DeleteFileButton fileId={file.id} filename={file.filename} />
      </div>
    </li>
  );
}

/* ── Overview ───────────────────────────────────────────────────── */

export function DashboardOverview({ data }: { data: DashboardData }) {
  const { usage, limits, plan } = data;
  const storagePct = usage.storageQuota ? (usage.storageUsed / usage.storageQuota) * 100 : 0;
  const dailyFinite = Number.isFinite(usage.dailyQuota);
  const tasksPct = dailyFinite ? (usage.tasksToday / usage.dailyQuota) * 100 : 0;
  const recentConversions = data.conversions.slice(0, 5);
  const recentFiles = data.files.slice(0, 5);

  return (
    <div>
      <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome back
            <WavingHand className="h-9 w-9 sm:h-11 sm:w-11" />
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Here&apos;s your {limits.label} workspace. Files auto-delete after {RETENTION_MINUTES} minutes.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <RefreshButton />
          <Button asChild variant="gradient" size="lg" className="shadow-glow">
            <Link href="/tools">
              New conversion <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </section>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          icon={Files}
          label="Stored files"
          value={String(usage.filesActive)}
          caption={`Auto-deleted after ${RETENTION_MINUTES} min`}
        />
        <MetricCard
          icon={Zap}
          label="Tasks today"
          value={`${usage.tasksToday} / ${formatTaskQuota(usage.dailyQuota)}`}
          progress={dailyFinite ? tasksPct : undefined}
          caption={dailyFinite ? `${limits.dailyTasks} per day on ${limits.label}` : "Unlimited on Pro"}
        />
        <MetricCard
          icon={HardDrive}
          label="Storage used"
          value={formatBytes(usage.storageUsed)}
          progress={storagePct}
          caption={`of ${formatBytes(usage.storageQuota)}`}
        />
        <MetricCard
          icon={Crown}
          label="Current plan"
          value={limits.label}
          caption={plan === "free" ? "Upgrade for more" : "Thanks for being Pro 💜"}
        />
      </section>

      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent Conversions</CardTitle>
            <Link
              href="/dashboard?tab=conversions"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentConversions.length === 0 ? (
              <EmptyState
                icon={RefreshCw}
                title="No conversions yet"
                hint="Run your first tool and it'll show up here."
              />
            ) : (
              <ul className="divide-y divide-border">
                {recentConversions.map((row) => (
                  <ConversionRow key={row.id} row={row} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent Files</CardTitle>
            <Link
              href="/dashboard?tab=files"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              View all <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {recentFiles.length === 0 ? (
              <EmptyState
                icon={Files}
                title="No files yet"
                hint="Processed files appear here for 60 minutes, then auto-delete."
              />
            ) : (
              <ul className="divide-y divide-border">
                {recentFiles.map((file) => (
                  <FileRow key={file.id} file={file} />
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>

      <section className="mb-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold tracking-tight">Quick Actions</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Jump straight into one of your most-used tools.
            </p>
          </div>
          <Link
            href="/tools"
            className="hidden shrink-0 items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80 sm:inline-flex"
          >
            Browse all tools <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED_TOOLS.slice(0, 6).map((tool) => (
            <ToolCard key={tool.slug} tool={tool} />
          ))}
        </div>
      </section>
    </div>
  );
}

/* ── My Files ───────────────────────────────────────────────────── */

export function FilesView({ data }: { data: DashboardData }) {
  const { files, usage } = data;
  const storagePct = usage.storageQuota ? (usage.storageUsed / usage.storageQuota) * 100 : 0;

  return (
    <div>
      <SectionTitle
        title="My Files"
        subtitle={`${formatBytes(usage.storageUsed)} of ${formatBytes(usage.storageQuota)} used · files auto-delete after ${RETENTION_MINUTES} minutes`}
        action={<RefreshButton />}
      />
      <Card className="mb-6 p-5">
        <div className="mb-2 flex items-center justify-between text-sm">
          <span className="font-medium">Storage</span>
          <span className="text-muted-foreground">{Math.round(storagePct)}%</span>
        </div>
        <ProgressBar value={storagePct} />
      </Card>

      <Card>
        <CardContent className="pt-6">
          {files.length === 0 ? (
            <EmptyState
              icon={Files}
              title="No files yet"
              hint="Processed files appear here for 60 minutes, then auto-delete."
            />
          ) : (
            <ul className="divide-y divide-border">
              {files.map((file) => (
                <FileRow key={file.id} file={file} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Conversions ────────────────────────────────────────────────── */

export function ConversionsView({ data }: { data: DashboardData }) {
  const { conversions, usage, limits } = data;
  const dailyFinite = Number.isFinite(usage.dailyQuota);
  const tasksPct = dailyFinite ? (usage.tasksToday / usage.dailyQuota) * 100 : 0;

  return (
    <div>
      <SectionTitle
        title="Conversions"
        subtitle={`${usage.tasksToday} of ${formatTaskQuota(usage.dailyQuota)} tasks used today on the ${limits.label} plan`}
        action={<RefreshButton />}
      />
      {dailyFinite && (
        <Card className="mb-6 p-5">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-medium">Daily usage</span>
            <span className="text-muted-foreground">
              {usage.tasksToday} / {usage.dailyQuota}
            </span>
          </div>
          <ProgressBar value={tasksPct} />
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          {conversions.length === 0 ? (
            <EmptyState
              icon={RefreshCw}
              title="No conversions yet"
              hint="Run your first tool and it'll show up here."
            />
          ) : (
            <ul className="divide-y divide-border">
              {conversions.map((row) => (
                <ConversionRow key={row.id} row={row} />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ── Settings ───────────────────────────────────────────────────── */

function PlanLimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border py-2.5 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-semibold">{value}</span>
    </div>
  );
}

export function SettingsView({ data }: { data: DashboardData }) {
  const { limits, plan, usage, email, name } = data;
  const storagePct = usage.storageQuota ? (usage.storageUsed / usage.storageQuota) * 100 : 0;

  return (
    <div className="max-w-3xl">
      <SectionTitle title="Settings" subtitle="Manage your account, plan and usage." />

      {/* Account */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Account</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <UserIcon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Name</p>
              <p className="text-sm font-medium">{name ?? "—"}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary">
              <Mail className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{email ?? "—"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Plan & usage */}
      <Card className="mb-6">
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <CardTitle>Plan &amp; Usage</CardTitle>
          <Badge variant={plan === "free" ? "muted" : "success"}>
            <Crown className="mr-1 h-3 w-3" /> {limits.label}
          </Badge>
        </CardHeader>
        <CardContent>
          <PlanLimitRow label="Storage" value={formatBytes(limits.storageBytes)} />
          <PlanLimitRow label="Max file size" value={formatBytes(limits.maxFileBytes)} />
          <PlanLimitRow label="Tasks per day" value={formatTaskQuota(limits.dailyTasks)} />
          <PlanLimitRow label="Auto-delete files after" value={`${RETENTION_MINUTES} minutes`} />

          <div className="mt-5">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="font-medium">Storage used</span>
              <span className="text-muted-foreground">
                {formatBytes(usage.storageUsed)} / {formatBytes(usage.storageQuota)}
              </span>
            </div>
            <ProgressBar value={storagePct} />
          </div>

          {plan === "free" && (
            <Button asChild variant="gradient" className="mt-5 w-full">
              <Link href="/#pricing">
                <Sparkles className="h-4 w-4" /> Upgrade to Pro — 2 GB storage, 1 GB files, unlimited tasks
              </Link>
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Session */}
      <Card>
        <CardHeader>
          <CardTitle>Session</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            Sign out of your account on this device.
          </div>
          <SignOutButton variant="outline" />
        </CardContent>
      </Card>
    </div>
  );
}
