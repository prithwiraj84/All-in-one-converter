"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Copy,
  Download,
  File as FileIcon,
  Loader2,
  RotateCcw,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { getTool } from "@/lib/tools-registry";
import { useToolRunner } from "@/hooks/use-tool-runner";
import { useUser } from "@/hooks/use-user";
import { usePlan } from "@/hooks/use-plan";
import { createClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { downloadUrl, triggerDownload } from "@/lib/api";
import {
  clearPendingDownload,
  getPendingDownload,
  type PendingDownload,
} from "@/lib/pending-download";
import { formatBytes } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Textarea } from "@/components/ui/textarea";
import { Loader } from "@/components/shared/loader";
import { FileDropzone } from "./file-dropzone";
import { DownloadGate } from "./download-gate";
import { ToolOptionsForm, defaultOptionValues, type OptionValues } from "./tool-options-form";

export function ToolWorkspace({ slug }: { slug: string }) {
  const tool = getTool(slug);
  const [files, setFiles] = useState<File[]>([]);
  const [options, setOptions] = useState<OptionValues>(() => defaultOptionValues(tool?.options));
  const { state, run, cancel, reset } = useToolRunner(tool);
  const { user, loading: authLoading } = useUser();
  const { limits, tasksToday, storageUsed, loggedIn, ready: planReady, bumpTasks } = usePlan();

  // Per-file upload cap follows the user's plan (Free 10 MB · Pro 1 GB).
  const maxMb = Math.round(limits.maxFileBytes / (1024 * 1024));

  // Tools are free to try; downloading requires login. If keys aren't set up
  // yet, don't gate (the provider buttons would just error) — treat as allowed.
  const canDownload = !isSupabaseConfigured() || Boolean(user);

  // After the OAuth round-trip the in-memory result is gone, so we restore the
  // file the user was trying to download from sessionStorage.
  const [restored, setRestored] = useState<PendingDownload | null>(null);
  useEffect(() => {
    if (!authLoading && user) {
      const p = getPendingDownload(slug);
      if (p) setRestored(p);
    }
  }, [authLoading, user, slug]);

  function handleRestoredDownload() {
    if (!restored) return;
    triggerDownload(restored.url, restored.filename);
    clearPendingDownload();
    setRestored(null);
    toast.success("Download started");
  }

  if (!tool) return null;

  const busy = state.stage === "uploading" || state.stage === "processing";
  const Icon = tool.icon;

  const mergedOptions = useMemo(() => {
    // Inject hidden defaults (e.g. fixed output format for jpg-to-png).
    const hidden: OptionValues = {};
    for (const o of tool.options ?? []) {
      if (o.type === "select" && o.hidden) hidden[o.name] = o.default;
    }
    return { ...hidden, ...options };
  }, [options, tool.options]);

  async function handleRun() {
    // Wait for a signed-in user's plan/usage to load before enforcing limits,
    // otherwise stale defaults (Free, 0 tasks) could let a quota be bypassed.
    if (loggedIn && !planReady) {
      toast.message("One moment — loading your plan…");
      return;
    }

    // ── Quota: per-file size (by plan) ──────────────────────────────
    const oversize = files.find((f) => f.size > limits.maxFileBytes);
    if (oversize) {
      toast.error(
        `"${oversize.name}" is ${formatBytes(oversize.size)} — over the ${formatBytes(
          limits.maxFileBytes,
        )} per-file limit on the ${limits.label} plan.`,
      );
      return;
    }

    // ── Quota: daily task limit (tracked for signed-in users) ───────
    if (loggedIn && Number.isFinite(limits.dailyTasks) && tasksToday >= limits.dailyTasks) {
      toast.error(
        `You've used all ${limits.dailyTasks} of today's tasks on the ${limits.label} plan. Upgrade to Pro for unlimited.`,
      );
      return;
    }

    // ── Quota: storage cap (approximate — measured on input size) ───
    const incoming = files.reduce((s, f) => s + f.size, 0);
    if (loggedIn && storageUsed + incoming > limits.storageBytes) {
      toast.error(
        `This would exceed your ${formatBytes(limits.storageBytes)} storage on the ${limits.label} plan (${formatBytes(
          storageUsed,
        )} already used). Files auto-delete after 60 min, or upgrade to Pro.`,
      );
      return;
    }

    let token: string | undefined;
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      token = data.session?.access_token;
    } catch {
      /* anonymous usage is allowed */
    }

    const result = await run(files, mergedOptions, token);

    // History + usage are recorded authoritatively by the backend (it counts
    // the task and enforces the quota). Optimistically bump the local count so
    // the UI reflects it immediately.
    if (result && result.status !== "failed" && loggedIn) {
      bumpTasks();
    }
  }

  function handleReset() {
    reset();
    setFiles([]);
  }

  return (
    <div className="space-y-4">
      {/* Post-login restore: the file they tried to download before signing in */}
      {restored && (state.stage === "idle" || state.stage === "error") && (
        <div className="flex flex-col gap-3 rounded-2xl border-2 border-success/30 bg-success/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-success/15 text-success">
              <CheckCircle2 className="h-5 w-5" />
            </span>
            <div>
              <p className="text-sm font-bold leading-tight">Welcome back — your file is ready!</p>
              <p className="text-xs text-muted-foreground">
                {restored.filename ?? "Your processed file"}
              </p>
            </div>
          </div>
          <Button variant="gradient" onClick={handleRestoredDownload}>
            <Download className="h-4 w-4" /> Download
          </Button>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-card">
      {/* header */}
      <div className="flex items-center gap-3 border-b border-border bg-surface/60 px-6 py-4">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-brand-gradient text-white">
          <Icon className="h-5 w-5" />
        </span>
        <div>
          <h2 className="font-display text-base font-semibold leading-tight">{tool.title}</h2>
          <p className="text-xs text-muted-foreground">{tool.description}</p>
        </div>
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait">
          {/* ── DONE ─────────────────────────────────────────── */}
          {state.stage === "done" && state.result ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <div className="flex flex-col items-center gap-3 rounded-xl bg-success/5 py-8 text-center">
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 260, damping: 18 }}
                  className="grid h-14 w-14 place-items-center rounded-full bg-success/15 text-success"
                >
                  <CheckCircle2 className="h-8 w-8" />
                </motion.span>
                <div>
                  <p className="font-display text-lg font-semibold">All done!</p>
                  <p className="text-sm text-muted-foreground">
                    Your file was processed successfully.
                  </p>
                </div>
              </div>

              {tool.resultType === "text" ? (
                <div className="space-y-2">
                  <Textarea
                    readOnly
                    value={state.result.text ?? ""}
                    className="min-h-[220px] font-mono text-xs leading-relaxed"
                  />
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      navigator.clipboard.writeText(state.result?.text ?? "");
                      toast.success("Copied to clipboard");
                    }}
                  >
                    <Copy className="h-4 w-4" /> Copy text
                  </Button>
                </div>
              ) : state.result.files && state.result.files.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium">
                    {state.result.files.length} files extracted
                  </p>
                  <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                    {state.result.files.map((f) => (
                      <li key={f.name} className="flex items-center gap-3 px-3.5 py-2.5">
                        <FileIcon className="h-4 w-4 shrink-0 text-muted-foreground" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">{f.name}</p>
                          <p className="text-xs text-muted-foreground">{formatBytes(f.size)}</p>
                        </div>
                        {canDownload && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="shrink-0"
                            onClick={() => triggerDownload(downloadUrl(f.download_url), f.name)}
                          >
                            <Download className="h-3.5 w-3.5" /> Save
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-1 rounded-xl border border-border p-4 text-center">
                  <p className="text-sm font-medium">
                    {state.result.output_filename ?? "output"}
                  </p>
                  {state.result.output_size ? (
                    <p className="text-xs text-muted-foreground">
                      {formatBytes(state.result.output_size)}
                    </p>
                  ) : null}
                </div>
              )}

              <div className="flex flex-col gap-2 sm:flex-row">
                {tool.resultType === "file" &&
                  state.result.download_url &&
                  (authLoading ? (
                    <Button variant="gradient" size="lg" className="flex-1" disabled>
                      <Loader2 className="h-4 w-4 animate-spin" /> Preparing…
                    </Button>
                  ) : canDownload ? (
                    <Button
                      variant="gradient"
                      size="lg"
                      className="flex-1"
                      onClick={() =>
                        triggerDownload(
                          downloadUrl(state.result!.download_url!),
                          state.result!.output_filename,
                        )
                      }
                    >
                      <Download className="h-4 w-4" />
                      {state.result.files && state.result.files.length > 0
                        ? "Download all (.zip)"
                        : "Download"}
                    </Button>
                  ) : null)}
                <Button variant="outline" size="lg" className="flex-1" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4" /> Convert another
                </Button>
              </div>

              {/* Free to try, sign in to download */}
              {tool.resultType === "file" &&
                state.result.download_url &&
                !authLoading &&
                !canDownload && (
                  <DownloadGate
                    pending={{
                      slug,
                      url: downloadUrl(state.result.download_url),
                      filename: state.result.output_filename,
                      createdAt: Date.now(),
                    }}
                    redirectTo={`/${slug}`}
                  />
                )}
            </motion.div>
          ) : busy ? (
            /* ── BUSY ───────────────────────────────────────── */
            <motion.div
              key="busy"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-5 py-10 text-center"
            >
              <Loader size={64} />
              <div className="w-full max-w-sm space-y-2">
                <p className="font-medium">
                  {state.stage === "uploading" ? "Uploading your files…" : "Processing…"}
                </p>
                <Progress value={state.stage === "uploading" ? state.progress : 100} />
                <p className="text-xs text-muted-foreground">
                  {state.stage === "uploading"
                    ? `${state.progress}%`
                    : "Crunching the bytes — this won't take long."}
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={cancel}>
                Cancel
              </Button>
            </motion.div>
          ) : (
            /* ── IDLE / ERROR ───────────────────────────────── */
            <motion.div
              key="idle"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-5"
            >
              <FileDropzone
                files={files}
                onChange={setFiles}
                accept={tool.accept}
                multiple={tool.multiple}
                maxSizeMb={maxMb}
              />

              {tool.options && files.length > 0 && (
                <ToolOptionsForm options={tool.options} values={options} onChange={setOptions} />
              )}

              {state.stage === "error" && state.error && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{state.error}</span>
                </div>
              )}

              <Button
                variant="gradient"
                size="xl"
                className="w-full"
                onClick={handleRun}
                disabled={files.length === 0 || (loggedIn && !planReady)}
              >
                <Sparkles className="h-4 w-4" />
                {tool.actionLabel}
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Files are encrypted in transit and deleted automatically within 60 minutes.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      </div>
    </div>
  );
}
