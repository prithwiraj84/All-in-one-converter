"use client";

import { useCallback, useRef, useState } from "react";
import { runTool, API_BASE } from "@/lib/api";
import { isClientTool, runClientTool, type ClientFile } from "@/lib/client-tools";
import type { Tool } from "@/lib/tools-registry";
import type { JobResult } from "@/lib/types";

/** A short, URL-safe random id used to stream a job's processing progress. */
function randomJobId(): string {
  try {
    return crypto.randomUUID().replace(/-/g, "");
  } catch {
    return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  }
}

/** Build a JobResult-shaped envelope from in-browser outputs (blob: URLs). */
function clientResult(tool: Tool, outputs: ClientFile[]): JobResult {
  if (outputs.length === 1) {
    const f = outputs[0];
    return {
      job_id: "client",
      tool: tool.slug,
      status: "completed",
      client: true,
      download_url: URL.createObjectURL(f.blob),
      output_filename: f.filename,
      output_size: f.blob.size,
    };
  }
  return {
    job_id: "client",
    tool: tool.slug,
    status: "completed",
    client: true,
    files: outputs.map((f) => ({
      name: f.filename,
      download_url: URL.createObjectURL(f.blob),
      size: f.blob.size,
    })),
  };
}

/**
 * Poll an async (QStash) job until it finishes. Only used when the server
 * returns status:"queued" — which only happens once the async queue is
 * configured. Synchronous responses never reach here, so default behavior is
 * unchanged. Resolves with the final JobResult (completed or failed).
 */
async function pollJob(jobId: string, signal: AbortSignal): Promise<JobResult> {
  const deadline = Date.now() + 15 * 60 * 1000; // 15-minute ceiling
  while (Date.now() < deadline) {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const resp = await fetch(`${API_BASE}/api/jobs/${jobId}`, { signal });
      const rec = (await resp.json()) as { status?: string; result?: JobResult; error?: string };
      if (rec.status === "completed" && rec.result) return rec.result;
      if (rec.status === "failed") {
        return { job_id: jobId, tool: "", status: "failed", error: rec.error ?? "Processing failed." };
      }
      // queued / processing / unknown → keep polling
    } catch (err) {
      if ((err as Error).name === "AbortError") throw err;
      // transient network error → keep polling until the deadline
    }
  }
  throw new Error("Timed out waiting for the job to finish.");
}

export type RunnerStage = "idle" | "uploading" | "processing" | "done" | "error";

export interface RunnerState {
  stage: RunnerStage;
  /** Upload percentage (during "uploading"). */
  progress: number;
  /** Real server-side processing percentage (during "processing"); null until
   * the job reports a measurable percentage (show an indeterminate bar then). */
  processing: number | null;
  /** Human label for the current processing step, e.g. "transcoding video". */
  stageLabel: string | null;
  result: JobResult | null;
  error: string | null;
}

const INITIAL: RunnerState = {
  stage: "idle",
  progress: 0,
  processing: null,
  stageLabel: null,
  result: null,
  error: null,
};

/**
 * Drives a single tool execution: tracks upload progress, processing,
 * the final JobResult, and error/abort handling. Used by ToolRunner.
 */
export function useToolRunner(tool: Tool | undefined) {
  const [state, setState] = useState<RunnerState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);
  const esRef = useRef<EventSource | null>(null);

  const closeStream = useCallback(() => {
    esRef.current?.close();
    esRef.current = null;
  }, []);

  const run = useCallback(
    async (
      files: File[],
      options: Record<string, string | number | boolean>,
      token?: string,
    ): Promise<JobResult | null> => {
      if (!tool) return null;
      if (files.length === 0) {
        setState({ ...INITIAL, stage: "error", error: "Please add at least one file." });
        return null;
      }
      const controller = new AbortController();
      abortRef.current = controller;
      closeStream();

      // ── In-browser path: instant, private, no upload. Falls through to the
      // server if the browser can't handle this input/format (runClientTool
      // returns null on any unsupported case or failure).
      if (isClientTool(tool.slug)) {
        setState({ ...INITIAL, stage: "processing", processing: 100 });
        const outputs = await runClientTool(tool.slug, files, options);
        if (outputs && outputs.length > 0) {
          const result = clientResult(tool, outputs);
          setState({ ...INITIAL, stage: "done", progress: 100, result });
          return result;
        }
        // else: fall back to the server below
      }

      setState({ ...INITIAL, stage: "uploading" });

      // Subscribe to live processing progress for this job (best-effort — if the
      // browser/host can't stream, the bar simply falls back to indeterminate).
      const jobId = randomJobId();
      const openStream = () => {
        if (esRef.current) return;
        try {
          const es = new EventSource(`${API_BASE}/api/jobs/${jobId}/progress`);
          esRef.current = es;
          es.onmessage = (ev) => {
            try {
              const d = JSON.parse(ev.data) as { percent?: number; stage?: string; done?: boolean };
              if (d.done) {
                setState((s) => (s.stage === "processing" ? { ...s, processing: 100 } : s));
                closeStream();
              } else if (typeof d.percent === "number" && d.percent > 0) {
                setState((s) =>
                  s.stage === "processing"
                    ? { ...s, processing: d.percent!, stageLabel: d.stage ?? s.stageLabel }
                    : s,
                );
              }
            } catch {
              /* ignore malformed event */
            }
          };
          es.onerror = () => closeStream();
        } catch {
          /* EventSource unsupported — keep the indeterminate bar */
        }
      };

      try {
        let result = await runTool({
          endpoint: tool.endpoint,
          files,
          options,
          token,
          toolSlug: tool.slug,
          jobId,
          signal: controller.signal,
          onProgress: (percent) =>
            setState((s) => (s.stage === "uploading" ? { ...s, progress: percent } : s)),
          onUploadDone: () => {
            setState((s) => ({ ...s, stage: "processing" }));
            openStream();
          },
        });

        // Async queue: the server accepted the job and is processing it in the
        // background — poll until it completes. (Only when the queue is enabled;
        // otherwise the result is already final and this branch is skipped.)
        if (result.status === "queued") {
          closeStream();
          setState((s) => ({ ...s, stage: "processing", stageLabel: "queued" }));
          result = await pollJob(result.job_id, controller.signal);
        }

        closeStream();
        if (result.status === "failed") {
          setState({ ...INITIAL, stage: "error", progress: 100, result, error: result.error ?? "Processing failed." });
        } else {
          setState({ ...INITIAL, stage: "done", progress: 100, processing: 100, result });
        }
        return result;
      } catch (err) {
        closeStream();
        if ((err as Error).name === "AbortError") {
          setState(INITIAL);
        } else {
          setState({ ...INITIAL, stage: "error", error: (err as Error).message });
        }
        return null;
      }
    },
    [tool, closeStream],
  );

  const cancel = useCallback(() => {
    closeStream();
    abortRef.current?.abort();
  }, [closeStream]);

  const reset = useCallback(() => {
    closeStream();
    setState(INITIAL);
  }, [closeStream]);

  return { state, run, cancel, reset };
}
