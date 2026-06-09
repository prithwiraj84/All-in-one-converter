import Link from "next/link";
import {
  ArrowRight,
  Files,
  RefreshCw,
  HardDrive,
  Zap,
  FileText,
  FileImage,
  FileType2,
  AudioLines,
  Film,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { ToolCard } from "@/components/tools/tool-card";
import { FEATURED_TOOLS } from "@/lib/tools-registry";
import { formatBytes } from "@/lib/utils";
import { cn } from "@/lib/utils";

/* ─────────────────────────────────────────────────────────────
   Presentational widgets — kept in-file so this dashboard page is
   fully self-contained. Sample data below is illustrative for the
   demo; live data is wired in elsewhere.
   ───────────────────────────────────────────────────────────── */

/** A slim brand-gradient progress bar. `value` is a 0–100 percentage. */
function ProgressBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.max(0, Math.min(100, value));
  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-muted", className)}
    >
      <div
        className="h-full rounded-full bg-brand-gradient bg-[length:200%_200%] animate-gradient-shift transition-[width] duration-500"
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

/** Stat card: gradient icon tile + label + big number + a subtle progress hint. */
function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  progress,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
  progress?: number;
}) {
  return (
    <Card className="group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover">
      <span className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand-gradient opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20" />
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-brand-gradient bg-[length:200%_200%] text-white shadow-glow">
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        {hint && <span className="text-xs font-medium text-muted-foreground">{hint}</span>}
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="font-display text-3xl font-bold tracking-tight">{value}</p>
      </div>
      {typeof progress === "number" && <ProgressBar value={progress} className="mt-4" />}
    </Card>
  );
}

/** Usage card: like StatCard but leads with a labelled progress meter. */
function UsageCard({
  icon: Icon,
  label,
  value,
  caption,
  progress,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  caption: string;
  progress: number;
}) {
  return (
    <Card className="group relative overflow-hidden p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover">
      <span className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-brand-gradient opacity-0 blur-2xl transition-opacity duration-500 group-hover:opacity-20" />
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-5 w-5" strokeWidth={2.2} />
        </span>
        <span className="text-xs font-medium text-muted-foreground">{Math.round(progress)}%</span>
      </div>
      <div className="mt-4 space-y-1">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <p className="font-display text-3xl font-bold tracking-tight">{value}</p>
      </div>
      <ProgressBar value={progress} className="mt-4" />
      <p className="mt-2 text-xs text-muted-foreground">{caption}</p>
    </Card>
  );
}

/** Map a conversion status to a Badge variant + label. */
const STATUS_BADGE: Record<string, { variant: BadgeProps["variant"]; label: string }> = {
  completed: { variant: "success", label: "Completed" },
  processing: { variant: "accent", label: "Processing" },
  queued: { variant: "muted", label: "Queued" },
  failed: { variant: "outline", label: "Failed" },
};

function StatusBadge({ status }: { status: keyof typeof STATUS_BADGE }) {
  const cfg = STATUS_BADGE[status] ?? STATUS_BADGE.completed;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

/* ── Sample data (demo only — not from Supabase) ─────────────── */

const STORAGE_USED_BYTES = 240 * 1024 * 1024; // 240 MB
const STORAGE_QUOTA_BYTES = 2 * 1024 * 1024 * 1024; // 2 GB
const CONVERSIONS_USED = 42;
const CONVERSIONS_QUOTA = 100;

interface ConversionRow {
  tool: string;
  filename: string;
  status: keyof typeof STATUS_BADGE;
  when: string;
  icon: LucideIcon;
}

const RECENT_CONVERSIONS: ConversionRow[] = [
  { tool: "Merge PDF", filename: "Q2-report-merged.pdf", status: "completed", when: "2 hours ago", icon: FileText },
  { tool: "Image Converter", filename: "hero-banner.webp", status: "completed", when: "5 hours ago", icon: FileImage },
  { tool: "Video Converter", filename: "product-demo.mp4", status: "processing", when: "6 hours ago", icon: Film },
  { tool: "PDF to Word", filename: "contract-draft.docx", status: "completed", when: "Yesterday", icon: FileType2 },
  { tool: "Audio Converter", filename: "podcast-ep-12.mp3", status: "queued", when: "Yesterday", icon: AudioLines },
];

interface FileRow {
  name: string;
  meta: string;
  when: string;
  icon: LucideIcon;
}

const RECENT_FILES: FileRow[] = [
  { name: "Q2-report-merged.pdf", meta: "PDF · 4.2 MB", when: "2 hours ago", icon: FileText },
  { name: "hero-banner.webp", meta: "Image · 318 KB", when: "5 hours ago", icon: FileImage },
  { name: "contract-draft.docx", meta: "Document · 1.1 MB", when: "Yesterday", icon: FileType2 },
  { name: "podcast-ep-12.mp3", meta: "Audio · 28 MB", when: "Yesterday", icon: AudioLines },
  { name: "onboarding-tour.mov", meta: "Video · 142 MB", when: "2 days ago", icon: Film },
];

export default async function DashboardHome() {
  const storagePct = (STORAGE_USED_BYTES / STORAGE_QUOTA_BYTES) * 100;
  const usagePct = (CONVERSIONS_USED / CONVERSIONS_QUOTA) * 100;

  return (
    <div>
      {/* ── 1. Greeting header ─────────────────────────────── */}
      <section className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome back <span aria-hidden>👋</span>
          </h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Here&apos;s what&apos;s happening in your workspace. Pick up where you left off or start a
            fresh conversion.
          </p>
        </div>
        <Button asChild variant="gradient" size="lg" className="shrink-0 shadow-glow">
          <Link href="/tools">
            New conversion
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </section>

      {/* ── 2. Stat cards ──────────────────────────────────── */}
      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          icon={Files}
          label="Files processed"
          value="128"
          hint="All time"
          progress={78}
        />
        <StatCard
          icon={RefreshCw}
          label="Conversions this month"
          value="42"
          hint="+12 this week"
          progress={64}
        />
        <UsageCard
          icon={HardDrive}
          label="Storage used"
          value={formatBytes(STORAGE_USED_BYTES)}
          caption={`${formatBytes(STORAGE_USED_BYTES)} of ${formatBytes(STORAGE_QUOTA_BYTES)} used`}
          progress={storagePct}
        />
        <UsageCard
          icon={Zap}
          label="Conversion usage"
          value={`${CONVERSIONS_USED} / ${CONVERSIONS_QUOTA}`}
          caption={`${CONVERSIONS_USED} of ${CONVERSIONS_QUOTA} conversions used`}
          progress={usagePct}
        />
      </section>

      {/* ── 3. Recent activity columns ─────────────────────── */}
      <section className="mb-8 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Conversions */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent Conversions</CardTitle>
            <Link
              href="/dashboard?tab=conversions"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {RECENT_CONVERSIONS.map((row) => (
                <li key={row.filename} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                    <row.icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{row.tool}</p>
                    <p className="truncate text-xs text-muted-foreground">{row.filename}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <StatusBadge status={row.status} />
                    <span className="text-xs text-muted-foreground">{row.when}</span>
                  </div>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Recent Files */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle>Recent Files</CardTitle>
            <Link
              href="/dashboard?tab=files"
              className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-colors hover:text-primary/80"
            >
              View all
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            <ul className="divide-y divide-border">
              {RECENT_FILES.map((file) => (
                <li key={file.name} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-secondary/10 text-secondary">
                    <file.icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">{file.name}</p>
                    <p className="truncate text-xs text-muted-foreground">{file.meta}</p>
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{file.when}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </section>

      {/* ── 4. Quick actions ───────────────────────────────── */}
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
            Browse all tools
            <ArrowRight className="h-3.5 w-3.5" />
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
